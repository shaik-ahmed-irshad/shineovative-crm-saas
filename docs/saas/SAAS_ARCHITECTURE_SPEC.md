# Shineovative WhatsApp CRM SaaS — Technical Architecture & Multi-Tenancy Specification

## 1. Architectural Principles

1. **Single-Codebase, Shared-Database Multi-Tenancy**:
   - All tenant organizations share the same Next.js application codebase and PostgreSQL database instance.
   - Tenancy is partitioned logically via `account_id` (UUID) present on every business entity table.
2. **PostgreSQL Row-Level Security (RLS) as the Primary Boundary**:
   - Security is enforced in the database kernel, not solely in application code.
   - Even if an API route forgets a `WHERE account_id = ...` clause, PostgreSQL RLS drops rows belonging to other tenants.
3. **High Performance & Zero-Recursion RLS**:
   - Avoid recursive joins in RLS policies by using cached PostgreSQL session variables or indexed helper functions (`auth.account_id()`, `auth.is_super_admin()`).
4. **Encrypted Tenant Secrets**:
   - All sensitive tenant credentials (Meta System User Tokens, WhatsApp App Secrets, BYO AI API Keys) are encrypted at rest using AES-256-GCM via the application's encryption layer.

---

## 2. Tenancy Hierarchy & Entity Relationship Model

```
                    ┌─────────────────────────┐
                    │  Platform Super Admin   │ (Shineovative Internal)
                    └───────────┬─────────────┘
                                │ oversees all
                                ▼
                    ┌─────────────────────────┐
                    │  accounts (Tenant Org)  │ (e.g. Acme Solar, Apex Retail)
                    │  id, name, slug, status │
                    └───────────┬─────────────┘
                                │ 1-to-many
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ account_members │    │ whatsapp_configs│    │ subscriptions   │
│ user_id, role   │    │ phone_id, waba  │    │ plan, limits    │
└────────┬────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  auth.users /   │
│    profiles     │
└─────────────────┘
```

### Core Tenancy Tables

#### `public.accounts` (Organizations)
Represents a customer organization subscribing to the CRM platform.
- `id`: UUID (Primary Key)
- `name`: TEXT (e.g. "Acme Corp")
- `slug`: TEXT UNIQUE (e.g. "acme-corp")
- `logo_url`: TEXT
- `owner_user_id`: UUID (REFERENCES `auth.users(id)`)
- `status`: TEXT CHECK (`status IN ('active', 'past_due', 'suspended', 'cancelled')`)
- `plan_tier`: TEXT DEFAULT 'starter'
- `created_at`: TIMESTAMPTZ DEFAULT NOW()

#### `public.account_members` (Tenant Membership & Permissions)
Maps authenticated users to organizations with specific access levels.
- `id`: UUID (Primary Key)
- `account_id`: UUID NOT NULL REFERENCES `public.accounts(id)` ON DELETE CASCADE
- `user_id`: UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE
- `role`: TEXT NOT NULL CHECK (`role IN ('owner', 'admin', 'agent', 'viewer')`)
- `created_at`: TIMESTAMPTZ DEFAULT NOW()
- `UNIQUE(account_id, user_id)`

---

## 3. Row-Level Security (RLS) Implementation Pattern

Every table holding tenant data (contacts, conversations, messages, deals, broadcasts, automations, flows, ai_configs, api_keys) includes:

```sql
account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE
```

### RLS Helper Functions

To ensure lightning-fast RLS evaluation, helper functions run with `SECURITY DEFINER` and `STABLE` caching:

```sql
-- Returns the active tenant account_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.current_user_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Checks if the authenticated user has platform super-admin privileges
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND platform_role = 'super_admin'
  );
$$;
```

### Standardized Table Policy Blueprint

```sql
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for contacts" ON public.contacts
FOR ALL
TO authenticated
USING (
  account_id = public.current_user_account_id()
  OR public.is_platform_super_admin()
)
WITH CHECK (
  account_id = public.current_user_account_id()
  OR public.is_platform_super_admin()
);
```

---

## 4. Multi-Tenant Inbound Webhook Routing

Meta WhatsApp Cloud API sends incoming webhook events containing the recipient's `phone_number_id`. The platform routes inbound messages to the correct tenant through the following flow:

```
[ Meta Cloud API Webhook Event ]
               │
               ▼
[ POST /api/whatsapp/webhook ]
               │
               ▼
  Extract `entry[0].changes[0].value.metadata.phone_number_id`
               │
               ▼
  Query `whatsapp_configs` WHERE phone_number_id = :phone_id
               │
               ▼
  Obtain `account_id` (Tenant context resolved)
               │
               ▼
  Execute atomic idempotent insert into `conversations` & `messages`
  under that specific `account_id`
```

---

## 5. Storage Bucket Isolation

Chat attachments (images, audio notes, PDF documents) and avatars are separated per tenant:

- **Chat Media**: Bucket `chat-media`
  - Storage path structure: `{account_id}/{conversation_id}/{timestamp}_{filename}`
  - RLS Policy: Users can only read/write files matching path prefix `public.current_user_account_id()`.
- **Avatars**: Bucket `profile-avatars`
  - Storage path structure: `{account_id}/{user_id}/avatar.webp`
