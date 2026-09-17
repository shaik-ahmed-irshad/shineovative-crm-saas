-- ============================================================
-- 102_saas_tenant_bootstrap.sql
--
-- Milestone 2: Customer Self-Serve Onboarding & Organization Bootstrap
--
-- What this migration does:
--   1. Extends `public.accounts` with:
--        - `timezone` TEXT NOT NULL DEFAULT 'Asia/Kolkata'
--        - `onboarding_completed_at` TIMESTAMPTZ (NULL = pending onboarding)
--   2. Replaces `public.handle_new_user()` with an atomic bootstrap
--      routine that on new user signup:
--        - Creates the tenant organization in `public.accounts`
--        - Stamps `public.profiles` as 'owner'
--        - Registers `public.account_members` as 'owner'
--        - Seeds default Sales Pipeline ('Sales Pipeline') with 5 stages:
--            New Lead (0), Qualified (1), Proposal Sent (2), Won (3), Lost (4)
--        - Seeds default CRM Tags:
--            Hot Lead (#ef4444), Follow Up (#f59e0b), VIP (#8b5cf6), Customer (#10b981)
--        - Seeds default Message Templates / Quick Replies:
--            'Welcome Intro' (Utility), 'Demo Booking' (Marketing)
--
-- Idempotent — safe to re-run multiple times.
-- ============================================================

-- 1. Extend accounts with timezone and onboarding completion timestamp
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_onboarding_completed_at
  ON public.accounts(onboarding_completed_at)
  WHERE onboarding_completed_at IS NULL;

-- 2. Enhanced atomic tenant bootstrap trigger
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

  -- 1. Create Organization Account
  INSERT INTO public.accounts (name, slug, owner_user_id, status, plan_tier, default_currency, timezone)
  VALUES (v_account_name, v_account_slug, NEW.id, 'active', 'all_in_one', 'USD', 'Asia/Kolkata')
  RETURNING id INTO v_account_id;

  -- 2. Create User Profile
  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role, platform_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner', 'none');

  -- 3. Register Member in account_members
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (v_account_id, NEW.id, 'owner')
  ON CONFLICT (account_id, user_id) DO UPDATE
  SET role = 'owner', updated_at = NOW();

  -- 4. Seed Default Sales Pipeline
  INSERT INTO public.pipelines (name, account_id, user_id)
  VALUES ('Sales Pipeline', v_account_id, NEW.id)
  RETURNING id INTO v_pipeline_id;

  -- 5. Seed Default Pipeline Stages
  INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
  VALUES
    (v_pipeline_id, 'New Lead', 0, '#3b82f6'),
    (v_pipeline_id, 'Qualified', 1, '#8b5cf6'),
    (v_pipeline_id, 'Proposal Sent', 2, '#f59e0b'),
    (v_pipeline_id, 'Won', 3, '#10b981'),
    (v_pipeline_id, 'Lost', 4, '#ef4444');

  -- 6. Seed Default CRM Tags
  INSERT INTO public.tags (account_id, user_id, name, color)
  VALUES
    (v_account_id, NEW.id, 'Hot Lead', '#ef4444'),
    (v_account_id, NEW.id, 'Follow Up', '#f59e0b'),
    (v_account_id, NEW.id, 'VIP', '#8b5cf6'),
    (v_account_id, NEW.id, 'Customer', '#10b981');

  -- 7. Seed Default Quick Replies / Message Templates
  INSERT INTO public.message_templates (
    account_id,
    user_id,
    name,
    category,
    language,
    body_text,
    status
  )
  VALUES
    (
      v_account_id,
      NEW.id,
      'Welcome Intro',
      'Utility',
      'en_US',
      'Hi {{1}}, thanks for reaching out to us! How can we help you today?',
      'Approved'
    ),
    (
      v_account_id,
      NEW.id,
      'Demo Booking',
      'Marketing',
      'en_US',
      'Hi {{1}}, thanks for your interest. You can book a quick 15-minute demo with our team here: {{2}}',
      'Approved'
    );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile/seeds for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
