# Shineovative WhatsApp CRM SaaS — Platform Super Admin Specification

## 1. Overview & Purpose

The **Platform Super Admin Portal** (`/super-admin`) is the internal command center for Shineovative administrators. It provides complete oversight across all customer organizations, monitoring platform health, managing subscription tiers, diagnosing tenant issues, and viewing global system metrics.

---

## 2. Security & Access Control

### Role Architecture

- **Platform Roles** (Global):
  - `super_admin`: Full access to `/super-admin`, ability to manage organizations, plans, and platform settings.
  - `support`: Read-only access to tenant diagnostics and audit logs.
  - `none`: Default for regular customer users (access denied).

### Next.js Middleware Gate

Every route under `/super-admin/*` is guarded by Next.js middleware and server-side session checks:

```typescript
// src/middleware.ts (Super Admin Gate)
if (request.nextUrl.pathname.startsWith('/super-admin')) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_role')
    .eq('user_id', session.user.id)
    .single();

  if (!profile || profile.platform_role !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}
```

---

## 3. Screen Hierarchy & Features

```text
/super-admin
  ├── /dashboard            (Global metrics & health KPIs)
  ├── /organizations        (Tenant directory & management)
  │     └── /[id]           (Tenant drilldown & diagnostics)
  ├── /plans                (Pricing tiers & feature limits)
  ├── /ai-analytics         (Platform-wide token & cost tracking)
  └── /audit-logs           (Platform administrative action trail)
```

### Screen 1: Dashboard (`/super-admin/dashboard`)
Actionable top-level KPIs for Shineovative management:
- **Total Active Tenants**: Count of organizations with `status = 'active'`.
- **Total CRM Users**: Total active agent/admin accounts across all organizations.
- **24-Hour Message Throughput**: Inbound + outbound WhatsApp messages handled across the platform.
- **Monthly Recurring Revenue (MRR)**: Aggregated active subscription value.
- **Platform Health Indicators**:
  - Webhook delivery success rate.
  - WhatsApp Cloud API error spikes.
  - Failed billing webhook alerts.

### Screen 2: Organizations Directory (`/super-admin/organizations`)
Searchable and filterable table of all customer organizations:
- **Columns**: Organization Name, Slug, Owner Email, Plan Tier, Member Count, Status (`active`, `past_due`, `suspended`), Created Date.
- **Actions**:
  - **Suspend Tenant**: Immediately halts outgoing broadcasts and restricts tenant users to a billing-update screen.
  - **Reactivate Tenant**: Restores full workspace access.
  - **Manual Plan Upgrade / Downgrade**: Adjusts plan tier without payment gateway for custom enterprise contracts.
  - **Inspect Workspace**: Opens tenant detail view.

### Screen 3: Organization Drilldown & Diagnostics (`/super-admin/organizations/[id]`)
Detailed inspection view for a single customer:
- **WhatsApp Integration Status**: Phone Number ID, WABA ID, webhook registration status, token expiration timestamp.
- **Resource Usage**: Current contacts count vs plan limit, broadcast usage for current billing cycle, AI tokens consumed.
- **Team Members**: List of users in this organization with their roles.
- **Read-Only Support View Mode**: Securely view the tenant's dashboard and pipelines for debugging customer support tickets (without exposing customer passwords).

### Screen 4: Audit Logs (`/super-admin/audit-logs`)
Immutable log of every administrative operation:
- Fields: `actor_user_id`, `actor_email`, `action` (e.g. `tenant.suspend`, `plan.override`), `target_account_id`, `ip_address`, `timestamp`.

---

## 4. Database Schema: `saas_audit_logs`

```sql
CREATE TABLE IF NOT EXISTS public.saas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accessible only by platform super admins
ALTER TABLE public.saas_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin audit log access" ON public.saas_audit_logs
FOR SELECT TO authenticated
USING (public.is_platform_super_admin());
```
