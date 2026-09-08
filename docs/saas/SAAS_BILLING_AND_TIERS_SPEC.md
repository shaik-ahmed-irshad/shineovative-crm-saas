# Shineovative WhatsApp CRM SaaS — Billing, Subscriptions & Quota Specification

## 1. Overview

This document specifies the monetization engine, pricing tiers, payment gateway integration, and automated quota enforcement for the Shineovative WhatsApp CRM SaaS.

---

## 2. Pricing Tiers & Feature Matrix

| Feature / Limit | Free Trial (14 Days) | Starter Plan | Growth Plan | Enterprise Plan |
|---|:---:|:---:|:---:|:---:|
| **Target Audience** | Evaluation | Small Teams & Startups | Growing SMBs | High-Volume Enterprises |
| **Team Seats (Members)** | Up to 2 | Up to 5 | Up to 15 | Unlimited |
| **Contacts Limit** | 500 | 2,500 | 25,000 | Custom / 100,000+ |
| **Monthly WhatsApp Campaigns** | 3 campaigns | 15 campaigns | 100 campaigns | Unlimited |
| **Active Sales Pipelines** | 1 pipeline | 3 pipelines | 10 pipelines | Unlimited |
| **No-Code Automations & Flows** | 3 active | 10 active | Unlimited | Unlimited |
| **AI Assistant** | BYO Key | BYO Key | 250k AI tokens included | 1M AI tokens included |
| **Audit Logs Retention** | 7 days | 30 days | 90 days | 1 year |

---

## 3. Database Schema: Billing & Subscriptions

```sql
-- 1. Available Pricing Plans
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,                       -- e.g. 'plan_starter', 'plan_growth', 'plan_enterprise'
  name TEXT NOT NULL,                        -- e.g. 'Starter Plan'
  description TEXT,
  price_monthly_inr INTEGER NOT NULL,        -- Amount in paise / INR cents
  price_monthly_usd INTEGER NOT NULL,        -- Amount in USD cents
  max_members INTEGER NOT NULL DEFAULT 5,
  max_contacts INTEGER NOT NULL DEFAULT 2500,
  max_campaigns_per_month INTEGER NOT NULL DEFAULT 15,
  max_pipelines INTEGER NOT NULL DEFAULT 3,
  ai_tokens_included INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tenant Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'razorpay')),
  customer_id TEXT NOT NULL,                 -- Stripe/Razorpay Customer ID
  subscription_id TEXT NOT NULL,             -- Stripe/Razorpay Subscription ID
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'unpaid')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Monthly Usage Tracking
CREATE TABLE IF NOT EXISTS public.tenant_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL,              -- Truncated to 1st of current month
  campaigns_sent INTEGER DEFAULT 0,
  outbound_messages_sent INTEGER DEFAULT 0,
  ai_tokens_consumed INTEGER DEFAULT 0,
  UNIQUE(account_id, billing_month)
);
```

---

## 4. Webhook Lifecycle State Machine

The billing webhook handler (`/api/webhooks/billing`) processes incoming payment gateway events:

```text
[ Gateway Event ]
        │
        ├── subscription.created / checkout.completed
        │     └── Insert subscription row, update accounts.status = 'active', set accounts.plan_tier
        │
        ├── invoice.paid
        │     └── Update current_period_end, reset monthly usage counters
        │
        ├── invoice.payment_failed
        │     └── Update status = 'past_due', dispatch warning email, grant 3-day grace period
        │
        └── subscription.cancelled / subscription.deleted
              └── Update status = 'cancelled', downgrade account features, notify owner
```

---

## 5. Automated Quota Enforcement Engine

Before performing resource-restricted actions, the application verifies the tenant's current usage against their plan limits:

### Seat / Member Enforcement
```typescript
// src/lib/billing/quota-guard.ts
export async function assertCanAddMember(accountId: string): Promise<void> {
  const { currentCount, maxAllowed } = await getMemberQuota(accountId);
  if (currentCount >= maxAllowed) {
    throw new QuotaExceededError(
      `Your organization has reached its limit of ${maxAllowed} members. Please upgrade your plan.`
    );
  }
}
```

### Contact Limit Enforcement
```typescript
export async function assertCanAddContacts(accountId: string, incomingCount: number = 1): Promise<void> {
  const { currentCount, maxAllowed } = await getContactQuota(accountId);
  if (currentCount + incomingCount > maxAllowed) {
    throw new QuotaExceededError(
      `Adding ${incomingCount} contacts would exceed your plan limit of ${maxAllowed} contacts.`
    );
  }
}
```

### UI Quota Banners
- When usage reaches **80%** of a plan quota, display an informative banner with an **Upgrade Plan** action.
- When usage reaches **100%**, disable the creation trigger button (e.g. `New Contact`, `Invite Member`, `Send Campaign`) and open the plan upgrade dialog.
