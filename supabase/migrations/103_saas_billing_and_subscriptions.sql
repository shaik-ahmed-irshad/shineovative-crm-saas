-- ============================================================
-- Migration 103: SaaS Billing, Subscriptions & Unified Invoicing
--
-- Implements:
-- 1. Alters accounts.status check constraint to support 'trialing'
-- 2. Creates public.subscriptions (unified Stripe + Razorpay records)
-- 3. Creates public.billing_invoices (payment receipts & invoice history)
-- 4. Updates handle_new_user() trigger to seed a 14-day trial
-- ============================================================

-- 1. ALTER ACCOUNTS.STATUS CONSTRAINT
DO $$
BEGIN
  -- Drop existing status check if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_status_check'
  ) THEN
    ALTER TABLE public.accounts DROP CONSTRAINT accounts_status_check;
  END IF;

  ALTER TABLE public.accounts ADD CONSTRAINT accounts_status_check
    CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));
END $$;

-- 2. CREATE PUBLIC.SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'stripe' CHECK (gateway IN ('stripe', 'razorpay')),
  customer_id TEXT,                         -- Stripe Customer ID or Razorpay Customer ID (nullable on trial)
  subscription_id TEXT,                     -- Stripe / Razorpay Subscription ID (nullable on trial)
  plan_code TEXT NOT NULL DEFAULT 'all_in_one',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('INR', 'USD')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'unpaid')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_account_id_key UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_account_id
  ON public.subscriptions(account_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_customer
  ON public.subscriptions(gateway, customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_subscription
  ON public.subscriptions(gateway, subscription_id);

-- Enable RLS on public.subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions RLS Policies:
-- Tenants can SELECT their own subscription
DROP POLICY IF EXISTS "subscriptions_select_tenant" ON public.subscriptions;
CREATE POLICY "subscriptions_select_tenant"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_account_member(account_id, 'viewer')
    OR public.is_platform_super_admin()
  );

-- Only backend service_role / security definer functions may mutate subscriptions
DROP POLICY IF EXISTS "subscriptions_service_all" ON public.subscriptions;
CREATE POLICY "subscriptions_service_all"
  ON public.subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 3. CREATE PUBLIC.BILLING_INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'razorpay')),
  invoice_id TEXT NOT NULL,
  amount_paid INTEGER NOT NULL,              -- in smallest currency unit (cents or paise)
  currency TEXT NOT NULL CHECK (currency IN ('INR', 'USD')),
  receipt_url TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_account_id
  ON public.billing_invoices(account_id);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_invoice_id
  ON public.billing_invoices(invoice_id);

-- Enable RLS on public.billing_invoices
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

-- Billing Invoices RLS Policies:
-- Tenants can view their own payment invoices
DROP POLICY IF EXISTS "billing_invoices_select_tenant" ON public.billing_invoices;
CREATE POLICY "billing_invoices_select_tenant"
  ON public.billing_invoices
  FOR SELECT
  TO authenticated
  USING (
    public.is_account_member(account_id, 'viewer')
    OR public.is_platform_super_admin()
  );

-- Mutation reserved for service_role
DROP POLICY IF EXISTS "billing_invoices_service_all" ON public.billing_invoices;
CREATE POLICY "billing_invoices_service_all"
  ON public.billing_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 4. UPGRADE HANDLE_NEW_USER() TO SEED 14-DAY TRIAL SUBSCRIPTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_name TEXT;
  v_account_slug TEXT;
  v_account_id UUID;
  v_pipeline_id UUID;
  v_currency TEXT;
BEGIN
  -- Extract user and organization metadata
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_account_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
    NULLIF(v_full_name, ''),
    NEW.email,
    'My Organization'
  );
  v_account_slug := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'organization_slug', ''),
    LOWER(REGEXP_REPLACE(v_account_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(NEW.id::text, 1, 8)
  );
  v_currency := COALESCE(NULLIF(NEW.raw_user_meta_data->>'currency', ''), 'USD');
  IF v_currency NOT IN ('INR', 'USD') THEN
    v_currency := 'USD';
  END IF;

  -- 1. Create Organization Account with 'trialing' status
  INSERT INTO public.accounts (name, slug, owner_user_id, status, plan_tier, default_currency, timezone)
  VALUES (v_account_name, v_account_slug, NEW.id, 'trialing', 'all_in_one', v_currency, 'Asia/Kolkata')
  RETURNING id INTO v_account_id;

  -- 2. Create User Profile
  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role, platform_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner', 'none');

  -- 3. Register Member in account_members
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (v_account_id, NEW.id, 'owner')
  ON CONFLICT (account_id, user_id) DO UPDATE
  SET role = 'owner', updated_at = NOW();

  -- 4. Seed 14-Day Free Trial Subscription Record
  INSERT INTO public.subscriptions (
    account_id,
    gateway,
    plan_code,
    billing_cycle,
    currency,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at
  )
  VALUES (
    v_account_id,
    CASE WHEN v_currency = 'INR' THEN 'razorpay' ELSE 'stripe' END,
    'all_in_one',
    'monthly',
    v_currency,
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days'
  )
  ON CONFLICT (account_id) DO NOTHING;

  -- 5. Seed Default Sales Pipeline
  INSERT INTO public.pipelines (account_id, name, is_default)
  VALUES (v_account_id, 'Sales Pipeline', true)
  RETURNING id INTO v_pipeline_id;

  -- 6. Seed Standard Pipeline Stages
  INSERT INTO public.pipeline_stages (pipeline_id, name, position)
  VALUES
    (v_pipeline_id, 'New Lead', 0),
    (v_pipeline_id, 'Qualified', 1),
    (v_pipeline_id, 'Proposal Sent', 2),
    (v_pipeline_id, 'Won', 3),
    (v_pipeline_id, 'Lost', 4);

  -- 7. Seed Standard CRM Tags
  INSERT INTO public.tags (account_id, name, color)
  VALUES
    (v_account_id, 'Hot Lead', '#ef4444'),
    (v_account_id, 'Follow Up', '#f59e0b'),
    (v_account_id, 'VIP', '#8b5cf6'),
    (v_account_id, 'Customer', '#10b981');

  -- 8. Seed Quick Replies / Message Templates
  INSERT INTO public.quick_replies (account_id, title, message_content, shortcut)
  VALUES
    (v_account_id, 'Welcome Intro', 'Hello! Thanks for reaching out to us. How can we help you today?', 'welcome'),
    (v_account_id, 'Demo Booking', 'Would you like to schedule a 15-minute product demonstration? Let us know your preferred time!', 'demo');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
