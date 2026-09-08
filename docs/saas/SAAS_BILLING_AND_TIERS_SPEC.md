# Shineovative WhatsApp CRM SaaS — Billing & Unified Payment Specification

## 1. Overview & Philosophy

To deliver the best customer experience with zero friction, the Shineovative WhatsApp CRM SaaS adopts a **Simple Single Subscription Model**. 

Instead of confusing tiers (Starter, Growth, Enterprise, Pro), customers pay a single, straightforward fee for **complete, unlimited access** to the CRM platform. Customers can choose between **Monthly** or **Annual (with discount)** billing cycles.

To serve both domestic (India) and international customers seamlessly, the platform utilizes a **Unified Billing Adapter** architecture supporting **Razorpay** (India: UPI, NetBanking, Cards in INR) and **Stripe** (International: Global Cards, Multi-currency, Apple Pay/Google Pay).

---

## 2. The Single Subscription Plan

### Pricing Structure
- **Monthly Billing**: ₹2,999 / month (Domestic INR) or $39 / month (International USD).
- **Annual Billing (20% Discount)**: ₹28,790 / year (₹2,399/mo) or $375 / year ($31/mo).
- **Free Trial**: 14-day fully featured free trial upon registration (no credit card required upfront).

### Included Features (All-In-One Access)
- **Unlimited Team Members & Seats** (No per-seat penalty).
- **Unlimited Contacts & Leads**.
- **Official WhatsApp Business API (WABA) Integration** (Cloud API direct connection).
- **Unlimited Pipelines & Custom Stages**.
- **Full Automation Workflows & Triggers**.
- **Team Inbox & Real-time Live Chat**.
- **Custom Tags, Quick Replies, and Media Management**.
- **Full Analytics, Export, and Audit Logs**.
- **AI Assistant**: Bring-Your-Own-Key (BYO-Key for OpenAI/OpenRouter/Anthropic) with optional platform credits.

---

## 3. Unified Billing Adapter Architecture

The backend implements an abstract provider interface `BillingProvider`. The platform automatically selects the appropriate provider based on the customer's region/currency or allows manual toggling:

```
                      ┌─────────────────────────────────┐
                      │    Unified Billing Controller    │
                      │     (/api/billing/checkout)     │
                      └────────────────┬────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
           [Currency == 'INR']                   [Currency == 'USD']
                    │                                     │
                    ▼                                     ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │   Razorpay Provider   │             │    Stripe Provider    │
        │   - UPI (GPay/PhonePe)│             │   - Global Cards      │
        │   - Domestic Cards    │             │   - Apple Pay / GPay  │
        │   - NetBanking        │             │   - Multi-Currency    │
        └───────────┬───────────┘             └───────────┬───────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │    Unified Webhook Dispatcher   │
                      │     (/api/webhooks/billing)     │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │  PostgreSQL: subscriptions row  │
                      │  accounts.status = 'active'     │
                      └─────────────────────────────────┘
```

### TypeScript Adapter Interface

```typescript
// src/lib/billing/types.ts

export type BillingGateway = 'stripe' | 'razorpay';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid';

export interface CreateCheckoutSessionParams {
  accountId: string;
  customerEmail: string;
  customerName: string;
  billingCycle: BillingCycle;
  currency: 'INR' | 'USD';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  gateway: BillingGateway;
  sessionId: string;
  checkoutUrl?: string; // For Stripe Hosted Checkout
  razorpayOrderId?: string; // For Razorpay Checkout Modal
  razorpayKeyId?: string;
  amount: number;
  currency: string;
}

export interface BillingProvider {
  createCustomer(accountId: string, email: string, name: string): Promise<string>;
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  getSubscription(subscriptionId: string): Promise<{
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  }>;
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
```

---

## 4. Database Schema: Subscriptions & Billing

```sql
-- 1. Unified Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'razorpay')),
  customer_id TEXT NOT NULL,                 -- Stripe Customer ID or Razorpay Customer ID
  subscription_id TEXT NOT NULL,             -- Stripe / Razorpay Subscription ID
  plan_code TEXT NOT NULL DEFAULT 'all_in_one',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  currency TEXT NOT NULL CHECK (currency IN ('INR', 'USD')),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'unpaid')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast status checks
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_status 
ON public.subscriptions(account_id, status);

-- 2. Payment Invoices History
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'razorpay')),
  invoice_id TEXT NOT NULL,
  amount_paid INTEGER NOT NULL,              -- in smallest currency unit (paise or cents)
  currency TEXT NOT NULL,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update accounts status check
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'trialing' 
CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));
```

---

## 5. Webhook Lifecycle State Machine

Both Stripe and Razorpay webhooks feed into the unified billing state machine:

| Event Type (Stripe / Razorpay) | State Action | Platform Behavior |
|---|---|---|
| `checkout.session.completed` / `subscription.authenticated` | Status → `active` | Organization status set to `active`. Owner notified with welcome receipt. |
| `invoice.paid` / `subscription.charged` | Extend `current_period_end` | Period extended by 1 month or 1 year. Receipt saved to `billing_invoices`. |
| `invoice.payment_failed` / `payment.failed` | Status → `past_due` | Account granted 3-day grace period. In-app warning banner displayed to owner. |
| `customer.subscription.deleted` / `subscription.cancelled` | Status → `cancelled` | Account access restricted to read-only export mode until reactivated. |

---

## 6. Access Enforcement Logic (Simple & Clean)

Because there are no complex feature tiers to meter, access enforcement is clean and binary:

1. **Active / Trialing Account**:
   - Full read/write access to all CRM routes, WhatsApp messaging, and automations.
2. **Past Due (Grace Period - Day 1 to 3)**:
   - Full access maintained. Persistent reminder banner displayed in dashboard.
3. **Past Due (Expired - Day 4+) or Cancelled**:
   - Read-only access enabled: Can view conversations, contacts, and export data.
   - Outbound WhatsApp sending and automated campaigns blocked with modal: *"Please update your payment method to resume messaging."*
