# Shineovative WhatsApp CRM SaaS — Implementation Roadmap & Execution Tracker

> **Mission:** Transform the frozen shared CRM core baseline (`core-v1-baseline`) into a scalable, enterprise-ready multi-tenant SaaS platform where businesses can self-signup, manage teams, connect WhatsApp numbers, automate workflows, and run daily sales operations under strict data isolation.

---

## Progress Overview

| Milestone | Target Scope | Weight | Status |
|---|---|:---:|:---:|
| **Milestone 1** | Multi-Tenancy Architecture & Strict RLS Hardening | 20% | `[ ]` Not Started |
| **Milestone 2** | Customer Self-Serve Onboarding & Organization Bootstrap | 15% | `[ ]` Not Started |
| **Milestone 3** | Platform Super Admin Portal (`/super-admin`) | 20% | `[ ]` Not Started |
| **Milestone 4** | Billing, Plans & Automated Quota Enforcement | 20% | `[ ]` Not Started |
| **Milestone 5** | Multi-Tenant WhatsApp Business API (WABA) Onboarding | 15% | `[ ]` Not Started |
| **Milestone 6** | Usage Metering, AI Quotas & Production Launch | 10% | `[ ]` Not Started |
| **Total** | **Full Multi-Tenant SaaS Platform** | **100%** | **0%** |

---

## Phased Execution Plan

### Milestone 1: Multi-Tenancy Architecture & Strict RLS Hardening (20%)
- **Objective:** Extend current account isolation to support explicit organization metadata, platform roles, and bulletproof tenant data isolation across all tables.
- **Key Deliverables:**
  - [ ] Migration `101_saas_tenancy_and_platform_roles.sql`:
    - Add `platform_role` column to `auth.users` / `profiles` (`super_admin`, `support`, `none`).
    - Extend `accounts` (organizations) with `slug`, `status` (`active`, `past_due`, `suspended`, `cancelled`), `plan_tier`, `created_at`.
    - Create cached helper functions for Supabase RLS: `auth.is_super_admin()`, `auth.current_account_id()`.
  - [ ] RLS Policy Hardening:
    - Audit all 41 existing tables to ensure queries automatically filter by `account_id = auth.current_account_id() OR auth.is_super_admin()`.
    - Ensure zero cross-tenant read/write leaks in Supabase Realtime subscriptions.
  - [ ] Multi-tenant automated security test suite (`seed-saas-security-audit.ts`):
    - Verify Organization A cannot access Organization B data under any role.

### Milestone 2: Customer Self-Serve Onboarding & Organization Bootstrap (15%)
- **Objective:** Enable new business owners to register, name their organization, choose their subdomain/workspace, and land in a pre-configured CRM.
- **Key Deliverables:**
  - [ ] Self-Service Signup Flow (`/signup`):
    - Re-enable self-signup flag (`publicSignup: true` for SaaS deployment).
    - Capture User Full Name, Business/Organization Name, and Password.
  - [ ] Atomic Tenant Bootstrap Trigger:
    - Automatically create `accounts` row (Organization).
    - Set user as `owner` in `profiles` and `account_members`.
    - Seed default sales pipeline stages (New Lead, Qualified, Proposal Sent, Won, Lost).
    - Seed default tags (Hot Lead, Follow Up, VIP) and standard quick replies.
  - [ ] Onboarding Wizard (`/onboarding`):
    - Step 1: Organization profile (Logo, currency, time zone).
    - Step 2: Invite initial team members.
    - Step 3: Connect WhatsApp Business Account.

### Milestone 3: Platform Super Admin Portal (`/super-admin`) (20%)
- **Objective:** Provide Shineovative administrators with a centralized control plane to oversee all tenant organizations, monitor usage, and troubleshoot accounts.
- **Key Deliverables:**
  - [ ] Dedicated Route Group & Middleware (`/super-admin`):
    - Strict role gate: verify `platform_role === 'super_admin'`.
    - Redirect unauthorized users with 403 Forbidden.
  - [ ] Organizations Directory (`/super-admin/organizations`):
    - List all customer organizations, owners, creation date, member counts, and active plan.
    - Search and filter by status (`active`, `suspended`, `trial`).
    - One-click actions: Suspend tenant, reactivate, extend trial.
  - [ ] Tenant Impersonation / View-As Mode:
    - Allow Super Admins to safely view a tenant's workspace for customer support without asking for user passwords.
    - Full audit logging of every admin action in `saas_audit_logs`.
  - [ ] Global Metrics Dashboard:
    - Total Organizations, Active Users, Daily Outbound Messages, AI token consumption across the platform.

### Milestone 4: Billing, Plans & Automated Quota Enforcement (20%)
- **Objective:** Monetize the platform via recurring subscriptions and automatically restrict features when quotas are reached.
- **Key Deliverables:**
  - [ ] Migration `102_saas_billing_and_subscriptions.sql`:
    - `plans` table (Starter, Growth, Enterprise).
    - `subscriptions` table (Stripe / Razorpay customer ID, subscription ID, status, current period end).
    - Quota definition: `max_members`, `max_contacts`, `max_campaigns_per_month`, `max_ai_tokens`.
  - [ ] Payment Gateway Integration:
    - Checkout session creation (Customer portal & subscription initiation).
    - Robust Webhook Handler (`/api/webhooks/billing`):
      - `subscription.created` → Activate account plan.
      - `invoice.paid` → Reset monthly counters and extend period.
      - `invoice.payment_failed` → Mark account as `past_due`.
      - `subscription.deleted` → Downgrade to Free / Suspend account.
  - [ ] Quota Guards in Application:
    - Prevent adding members when `member_count >= plan.max_members`.
    - Prevent contact creation/import when `contact_count >= plan.max_contacts`.
    - Display upgrade prompts in UI when approaching limits.

### Milestone 5: Multi-Tenant WhatsApp Business API (WABA) Onboarding (15%)
- **Objective:** Enable multiple independent organizations to connect their own official WhatsApp Business numbers seamlessly.
- **Key Deliverables:**
  - [ ] Per-Tenant WhatsApp Credentials:
    - Leverage existing encrypted storage (`whatsapp_configs` table).
    - Ensure phone number IDs and webhook routing identify the incoming tenant accurately.
  - [ ] Unified Inbound Webhook Dispatcher:
    - Incoming webhook from Meta contains `phone_number_id`.
    - Resolver identifies matching `whatsapp_configs.account_id` with 0 cross-talk.
  - [ ] Embedded Signup (Meta Tech Provider) or Manual BYO-Credentials:
    - Guide customer through Meta App ID, System User Token, and WABA Phone Number ID entry.

### Milestone 6: Usage Metering, AI Quotas & Production Launch (10%)
- **Objective:** Track variable costs (AI, media storage, broadcast messaging) and perform final multi-tenant production hardening.
- **Key Deliverables:**
  - [ ] AI Usage Metering:
    - Track prompt + completion tokens per tenant per billing cycle in `ai_usage_logs`.
    - Allow organizations to use Shineovative platform AI credits OR input their own OpenRouter/OpenAI API key.
  - [ ] Automated Cron for Quota Resets:
    - Nightly job to reset monthly campaign limits and check subscription expirations.
  - [ ] Multi-Tenant E2E Regression Gate:
    - Complete browser audit verifying tenant isolation, billing status changes, and message dispatch.

---

## Universal Commit & Syncing Discipline

All universal bug fixes and enhancements must adhere to the commit convention:
- `core:` Shared universal CRM enhancements (cherry-picked between Solar & SaaS)
- `saas:` Platform-only / multi-tenancy / billing / super admin changes
- `solar:` Solar Cubic internal-only changes
- `docs:` Documentation updates
