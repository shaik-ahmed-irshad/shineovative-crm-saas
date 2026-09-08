# Shineovative WhatsApp CRM SaaS — Enterprise Security & Cloud Hardening Specification

> **Standard:** Enterprise-Grade Cloud Security, Multi-Tenant Zero-Trust, OWASP Top 10 Compliance, SOC 2 / GDPR / ISO 27001 Readiness.

---

## 1. Threat Model & Security Principles

The Shineovative WhatsApp CRM SaaS operates under a **Zero-Trust Multi-Tenant Architecture**. 

### Core Security Tenets
1. **Never Trust the Client**: All authorization and tenancy decisions occur on the server and database levels. No query trusts client-supplied tenant identifiers (`account_id`).
2. **Database-Enforced Blast Radius**: A software bug in an application endpoint must **never** leak another tenant's data. Isolation is enforced in the database engine via PostgreSQL Row Level Security (RLS).
3. **Defense-in-Depth**: 4 independent verification layers: Edge Middleware → Next.js API/Server Actions → Supabase Service Layer → PostgreSQL RLS Engine.
4. **Least Privilege & Role Separation**: Tenant users never have access to platform administration; Platform Super Admins are strictly gated with immutable audit trails.

---

## 2. Multi-Tenant Data Isolation & Row-Level Security (RLS)

### Database Layer RLS Architecture
All 41+ tables storing business data (contacts, conversations, messages, deals, pipelines, notes, tasks, automations, templates, files) enforce PostgreSQL RLS.

```sql
-- Security Definer helper function running in trusted schema
CREATE OR REPLACE FUNCTION auth.current_account_id()
RETURNS UUID AS $$
  SELECT account_id FROM public.account_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Platform Super Admin check
CREATE OR REPLACE FUNCTION auth.is_platform_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND platform_role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Bulletproof Table Policy Pattern
Every table enforces identical granular policies preventing Insecure Direct Object References (IDOR):

```sql
-- Example: contacts table RLS policy
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy
CREATE POLICY "tenant_isolation_select_contacts" ON public.contacts
  FOR SELECT USING (
    account_id = auth.current_account_id() OR auth.is_platform_super_admin()
  );

-- 2. INSERT Policy
CREATE POLICY "tenant_isolation_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (
    account_id = auth.current_account_id()
  );

-- 3. UPDATE Policy
CREATE POLICY "tenant_isolation_update_contacts" ON public.contacts
  FOR UPDATE USING (
    account_id = auth.current_account_id()
  ) WITH CHECK (
    account_id = auth.current_account_id()
  );

-- 4. DELETE Policy
CREATE POLICY "tenant_isolation_delete_contacts" ON public.contacts
  FOR DELETE USING (
    account_id = auth.current_account_id() AND 
    EXISTS (
      SELECT 1 FROM public.account_members 
      WHERE user_id = auth.uid() AND account_id = contacts.account_id AND role IN ('owner', 'admin')
    )
  );
```

---

## 3. Cryptography & Secrets Management

### Column-Level Encryption for Sensitive Credentials
Tenants connect their own WhatsApp Business Accounts (WABA) with permanent Meta Access Tokens. These tokens are encrypted before storage using **AES-256-GCM** using a master encryption key (`ENCRYPTION_SECRET_KEY`) stored strictly as a server-side environment variable.

```
[ Plaintext Meta Token ]
           │
           ▼
[ AES-256-GCM Encryption ] + [ 96-bit Random IV ] + [ 128-bit Auth Tag ]
           │
           ▼
[ Storage in whatsapp_configs: iv:ciphertext:tag ]
```

### Secrets Segregation Matrix
| Secret Category | Examples | Storage Location | Exposure Scope |
|---|---|---|---|
| **Public Keys** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` / Client Bundle | Public / Browser |
| **Server Secrets** | `SUPABASE_SERVICE_ROLE_KEY` | Server Environment Only | Never exposed to browser |
| **Cryptographic Keys**| `ENCRYPTION_SECRET_KEY` | Server Environment Only | Server-side crypto routines |
| **Payment Secrets** | `STRIPE_SECRET_KEY`, `RAZORPAY_KEY_SECRET` | Server Environment Only | Server-side billing actions |
| **Webhook Secrets** | `META_APP_SECRET`, `STRIPE_WEBHOOK_SECRET` | Server Environment Only | Webhook signature check |

---

## 4. Webhook & Ingestion Security

### 1. Meta WhatsApp Webhooks
All incoming payloads from Meta (`/api/webhooks/whatsapp`) must pass HMAC-SHA256 signature verification before parsing:

```typescript
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const [prefix, signature] = signatureHeader.split('=');
  if (prefix !== 'sha256' || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.META_APP_SECRET!)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```
*Note: Uses `crypto.timingSafeEqual` to eliminate timing attack vulnerabilities.*

### 2. Billing Webhooks (Stripe & Razorpay)
- **Stripe**: Verified using `stripe.webhooks.constructEvent(payload, header, endpointSecret)`.
- **Razorpay**: Verified using `crypto.createHmac('sha256', secret).update(body).digest('hex') === signature`.
- **Replay Protection**: Timestamps older than 300 seconds (5 minutes) are immediately discarded.

---

## 5. Identity, Authentication & Session Security

1. **Authentication Flow**: Supabase Auth (GoTrue) using PKCE (Proof Key for Code Exchange) flow.
2. **Session Cookies**:
   - `HttpOnly`: Prevents client-side JavaScript access (mitigates XSS token theft).
   - `Secure`: Transmitted only over encrypted HTTPS connections.
   - `SameSite=Lax`: Protects against Cross-Site Request Forgery (CSRF).
3. **Role-Based Access Control (RBAC)**:
   - **Platform Level**: `platform_role` column in `profiles` (`super_admin`, `support`, `none`).
   - **Tenant Level**: `role` column in `account_members` (`owner`, `admin`, `agent`, `viewer`).
4. **Session Invalidation**:
   - Password reset immediately revokes all active refresh tokens.
   - Account suspension terminates active sessions via middleware cookie invalidation.

---

## 6. Cloud Storage & File Upload Security

All customer uploads (chat images, PDF contracts, audio notes, avatars) are stored in dedicated Supabase Storage buckets.

### Storage Isolation Rules
1. **Path-Based Segregation**: All tenant assets reside within `tenants/{account_id}/*`.
2. **Storage RLS Policies**:
   ```sql
   CREATE POLICY "tenant_storage_isolation" ON storage.objects
     FOR ALL USING (
       bucket_id = 'media' AND 
       (storage.foldername(name))[2] = auth.current_account_id()::text
     );
   ```
3. **File Validation at Ingestion**:
   - MIME-type validation against strict whitelist (`image/jpeg`, `image/png`, `application/pdf`, `audio/ogg`, `audio/mpeg`, `video/mp4`).
   - File extension spoofing detection.
   - Max file size limits enforced at edge: Images (10 MB), Audio (16 MB), Documents (25 MB), Video (50 MB).

---

## 7. Platform Super Admin & Impersonation Security

Super Admins have oversight powers, requiring heightened security safeguards:

1. **Dedicated Route Gating**:
   - `/super-admin/*` routes are intercepted by Next.js Edge Middleware.
   - Any request where `profile.platform_role !== 'super_admin'` receives an immediate `403 Forbidden` and is logged.
2. **Support Impersonation ("View-As") Guardrails**:
   - When viewing an organization for customer assistance, Super Admins operate in **Read-Only Mode**.
   - No passwords or personal customer tokens are decrypted or visible.
3. **Immutable Audit Logging (`saas_audit_logs`)**:
   - Every administrative action is logged to an append-only table:
     ```sql
     CREATE TABLE IF NOT EXISTS public.saas_audit_logs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       actor_id UUID NOT NULL REFERENCES public.profiles(id),
       target_account_id UUID REFERENCES public.accounts(id),
       action TEXT NOT NULL,         -- 'tenant.suspended', 'plan.extended', 'view_as.entered'
       metadata JSONB DEFAULT '{}',
       ip_address TEXT,
       user_agent TEXT,
       created_at TIMESTAMPTZ DEFAULT NOW()
     );
     ```
   - No `UPDATE` or `DELETE` policies exist on `saas_audit_logs` (tamper-proof record).

---

## 8. Network & Infrastructure Hardening

1. **TLS / HTTPS**: Strict TLS 1.3 encryption for all external communication.
2. **Hostinger Node.js Environment**:
   - Runs in isolated Linux container (`cgroups`).
   - Hard memory and process limits configured to prevent memory leak crashes.
3. **Rate Limiting**:
   - Auth endpoints (`/api/auth/*`): 10 requests per minute per IP.
   - Webhook endpoints: Burst-tolerant queueing to prevent denial-of-service spikes during Meta broadcasts.
4. **Header Hardening**:
   - `Content-Security-Policy` (CSP)
   - `X-Frame-Options: DENY` (Clickjacking mitigation)
   - `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
   - `Referrer-Policy: strict-origin-when-cross-origin`
