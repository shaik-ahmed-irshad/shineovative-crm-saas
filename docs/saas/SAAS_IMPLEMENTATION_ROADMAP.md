# Shineovative WhatsApp CRM SaaS — Implementation Roadmap & Execution Tracker

> **Mission:** Transform the frozen shared CRM core baseline (`core-v1-baseline`) into a scalable, enterprise-ready multi-tenant SaaS platform where businesses can self-signup, manage teams, connect WhatsApp numbers, automate workflows, and run daily sales operations under strict data isolation.

---

## Progress Overview — Multi-Tenant SaaS Core (Phase 1)

| Milestone | Target Scope | Weight | Status |
|---|---|:---:|:---:|
| **Milestone 1** | Multi-Tenancy Architecture & Strict RLS Hardening | 20% | `[x]` Completed |
| **Milestone 2** | Customer Self-Serve Onboarding & Organization Bootstrap | 15% | `[x]` Completed |
| **Milestone 3** | Platform Super Admin Portal (`/super-admin`) | 20% | `[x]` Completed |
| **Milestone 4** | Billing, Plans & Automated Quota Enforcement (Stripe + Razorpay) | 20% | `[x]` Completed |
| **Milestone 5** | Multi-Tenant WhatsApp Business API (WABA) Onboarding | 15% | `[x]` Completed |
| **Milestone 6** | Usage Metering, AI Quotas & Local Penetration Gate | 10% | `[x]` Completed |
| **Total Phase 1** | **Multi-Tenant SaaS Code & Local Docker Environment** | **100%** | **100% Complete** |

---

## Future Rollout & Production Timeline (Phase 2)

| Stage | Target Scope | External Dependency | Status |
|---|---|---|:---:|
| **Phase 7** | Dedicated Staging Cloud Supabase Setup & Migration | New Supabase Project Credentials | `[~]` Awaiting Credentials |
| **Phase 8** | Live Payment Gateway Webhook Testing | Stripe & Razorpay Test/Live API Keys | `[ ]` Ready for Keys |
| **Phase 9** | Meta Embedded Signup & Live WABA Testing | Meta App ID/Secret & Verified Phone SIM | `[ ]` Ready for WABA |
| **Phase 10** | Production Deployment on Hostinger (Node.js/PM2 + SSL) | Domain DNS (`app.shineovative.com`) | `[ ]` Not Started |
| **Phase 11** | Pilot Beta Customer Onboarding & Public Go-To-Market | 1-2 Pilot Businesses | `[ ]` Not Started |


---

## Phased Execution Plan

### Milestone 1: Multi-Tenancy Architecture & Strict RLS Hardening (20%) — COMPLETED
- **Objective:** Extend current account isolation to support explicit organization metadata, platform roles, and bulletproof tenant data isolation across all tables.
- **Key Deliverables:**
  - [x] Migration `101_saas_tenancy_and_platform_roles.sql`:
    - Add `platform_role` column to `auth.users` / `profiles` (`super_admin`, `support`, `none`).
    - Extend `accounts` (organizations) with `slug`, `status` (`active`, `past_due`, `suspended`, `cancelled`), `plan_tier`, `created_at`.
    - Create cached helper functions for Supabase RLS: `auth.is_super_admin()`, `auth.current_account_id()`, `public.current_user_account_id()`, `public.is_platform_super_admin()`.
  - [x] RLS Policy Hardening:
    - Upgrade `is_account_member()` to grant platform super admins cross-tenant oversight while enforcing zero-leak isolation for tenants.
    - Added `account_members` mapping table with synced trigger and strict RLS policies.
    - Added `saas_audit_logs` table with super-admin-only RLS policies.
    - Guarded `/super-admin/*` with Next.js edge middleware.
  - [x] Multi-tenant automated security test suite (`src/lib/auth/saas-security-audit.test.ts`):
    - Verify Organization A cannot access Organization B data under any role.
    - Verify platform privilege escalation defenses.
    - Verify role capability matrix and account lifecycle status gating.

### Milestone 2: Customer Self-Serve Onboarding & Organization Bootstrap (15%) — COMPLETED
- **Objective:** Enable new business owners to register, name their organization, choose their subdomain/workspace, and land in a pre-configured CRM.
- **Key Deliverables:**
  - [x] Self-Service Signup Flow (`/signup`):
    - Re-enabled public self-signup flag (`publicSignup: true` in `PRODUCT_CONFIG`).
    - Captured User Full Name, Business/Organization Name, and Password with 14-day trial reassurance.
  - [x] Atomic Tenant Bootstrap Trigger (`102_saas_tenant_bootstrap.sql`):
    - Automatically create `accounts` row (Organization with slug, timezone, status).
    - Set user as `owner` in `profiles` and `account_members`.
    - Seed default sales pipeline stages (New Lead, Qualified, Proposal Sent, Won, Lost).
    - Seed default tags (Hot Lead, Follow Up, VIP, Customer) and standard quick replies (`Welcome Intro`, `Demo Booking`).
  - [x] Onboarding Wizard (`/onboarding` & `/api/account/onboarding`):
    - Step 1: Organization profile (Company display name, Currency INR/USD/EUR/AED/GBP, Timezone).
    - Step 2: Connect WhatsApp Business Account or explore in Dry-Run / Test Mode.
    - Step 3: Fast team invitations input by email and role (`admin`, `agent`, `viewer`).
    - Completion celebration screen with direct route to `/dashboard`.

### Milestone 3: Platform Super Admin Portal (`/super-admin`) (20% - COMPLETED)
- **Objective:** Provide Shineovative administrators with a centralized control plane to oversee all tenant organizations, monitor usage, and troubleshoot accounts.
- **Key Deliverables:**
  - [x] Dedicated Route Group & Middleware (`/super-admin`):
    - Strict role gate: verify `platform_role === 'super_admin'`.
    - Redirect unauthorized users with 403 Forbidden.
  - [x] Organizations Directory (`/super-admin/organizations`):
    - List all customer organizations, owners, creation date, member counts, and active plan.
    - Search and filter by status (`active`, `suspended`, `trial`).
    - One-click actions: Suspend tenant, reactivate, inspect diagnostics.
  - [x] Tenant Impersonation / View-As Mode:
    - Allow Super Admins to safely view a tenant's workspace for customer support without asking for user passwords.
    - Full audit logging of every admin action in `saas_audit_logs`.
    - Dedicated Support Mode sticky banner with one-click exit.
  - [x] Global Metrics Dashboard:
    - Total Organizations, Active Users, Daily Outbound Messages, Connected WhatsApp Business Lines.
  - [x] Comprehensive test suite: `src/lib/auth/saas-super-admin.test.ts`.

### Milestone 4: Single Subscription & Unified Billing Engine (Razorpay + Stripe) (20% - COMPLETED)
- **Objective:** Monetize the platform via a simple, single all-in-one subscription with monthly/annual options using a unified billing adapter supporting Razorpay (India) and Stripe (Global).
- **Key Deliverables:**
  - [x] Migration `103_saas_billing_and_subscriptions.sql`:
    - `subscriptions` table (Unified schema for Stripe & Razorpay customer/subscription IDs, status, billing cycle, current period end, trial tracking).
    - `billing_invoices` table for receipt tracking and invoice history.
    - Simplified account status flags (`trialing`, `active`, `past_due`, `suspended`, `cancelled`).
    - Seeded initial 14-day trial in `handle_new_user()` trigger.
  - [x] Unified Billing Adapter Architecture:
    - Provider abstraction (`src/lib/billing/types.ts` & `src/lib/billing/`):
      - `RazorpayProvider`: UPI (Google Pay, PhonePe), Domestic Cards, NetBanking (INR).
      - `StripeProvider`: Global Cards, Apple Pay, Google Pay, Multi-currency (USD).
    - Auto-selection based on customer currency/region (`src/lib/billing/index.ts`).
  - [x] Unified Webhook Handler (`/api/webhooks/billing`):
    - Cryptographic signature validation for both Stripe (`stripe-signature`) and Razorpay (`x-razorpay-signature`) via HMAC SHA256.
    - State machine: `checkout.session.completed` / `order.paid` → activate; `invoice.paid` → extend period; `invoice.payment_failed` → grace period; `subscription.cancelled` → read-only mode.
  - [x] Access & Subscription Status Enforcement:
    - Clean binary access model: Active/Trial (full access) vs. Past Due (grace period) vs. Cancelled (read-only mode).
    - Outbound WhatsApp protection (`requireActiveSubscription(ctx)` in `/api/whatsapp/send`).
    - In-app payment reminders (`BillingAlertBanner`) and full billing management portal (`BillingSettingsPanel` at `/settings?tab=billing`).
  - [x] Comprehensive test suite: `src/lib/billing/saas-billing.test.ts`.

### Milestone 5: Multi-Tenant WhatsApp Business API (WABA) Onboarding (15% - COMPLETED)
- **Objective:** Enable multiple independent organizations to connect their own official WhatsApp Business numbers seamlessly.
- **Key Deliverables:**
  - [x] Per-Tenant WhatsApp Credentials:
    - Leverage encrypted storage (`whatsapp_config` table with AES-256-GCM).
    - Prevent cross-tenant phone number collisions: rejects duplicate claims across accounts with 409 Conflict.
  - [x] Unified Inbound Webhook Dispatcher:
    - Inbound messages from Meta contain `metadata.phone_number_id` &rarr; routed to the exact owning tenant account with 0 cross-talk.
    - Status callbacks (`delivered`, `read`, `failed`) scoped by `account_id` to prevent message ID collisions across numbers.
  - [x] WABA Onboarding Assistant API (`/api/whatsapp/onboarding`):
    - Automated Meta verification (`verifyPhoneNumber`), Cloud API registration (`registerPhoneNumber`), and app webhook subscription (`subscribeWabaToApp`).
    - Audit logging of all WABA connection events in `saas_audit_logs`.
    - Dedicated WABA setup and connection diagnostics card (`src/components/whatsapp/waba-setup-card.tsx`).
  - [x] Comprehensive test suite: `src/lib/whatsapp/saas-waba-isolation.test.ts`.

### Milestone 6: Usage Metering, AI Quotas & Production Launch (100% COMPLETE)
- **Objective:** Track variable costs (AI, media storage, broadcast messaging) and perform final multi-tenant production hardening.
- **Key Deliverables:**
  - [x] AI Usage Metering & Quotas:
    - Quota evaluator (`src/lib/ai/quota.ts`) calculating monthly token consumption from `ai_usage_log`.
    - Support for Bring Your Own Key (BYO-Key) with unlimited auto-replies and drafts.
    - 50,000 monthly complimentary AI tokens for tenants utilizing platform credits.
    - Endpoint `/api/ai/quota` returning current cycle usage, allowance, and reset schedule.
    - Visual quota progress bar & BYO-Key status badge integrated into `src/components/agents/ai-usage.tsx`.
  - [x] Automated Background Maintenance Cron (`/api/cron/maintenance`):
    - Guarded with `CRON_SECRET` validation (supports both `Authorization: Bearer` and `x-cron-secret`).
    - Transitions expired trials (`status = 'trialing'` and `trial_ends_at < NOW()`) to `'past_due'`.
    - Transitions past-due accounts beyond 3-day grace period to `'cancelled'`.
    - Logs platform execution reports to immutable `saas_audit_logs`.
  - [x] Comprehensive End-to-End Production Verification Gate:
    - `src/lib/saas-production.test.ts` verifying all 6 milestones end-to-end.
    - 921 passing tests across 86 test files, 0 type errors.

---

## Universal Commit & Syncing Discipline

All universal bug fixes and enhancements must adhere to the commit convention:
- `core:` Shared universal CRM enhancements (cherry-picked between Solar & SaaS)
- `saas:` Platform-only / multi-tenancy / billing / super admin changes
- `solar:` Solar Cubic internal-only changes
- `docs:` Documentation updates
