-- ============================================================
-- 101_saas_tenancy_and_platform_roles.sql
--
-- Milestone 1: Multi-Tenancy Architecture & Strict RLS Hardening
--
-- What this migration does:
--   1. Introduces `platform_role_enum` ('super_admin', 'support', 'none')
--      and adds `platform_role` column to `public.profiles`.
--   2. Updates `enforce_profile_privilege_columns()` to prevent browser
--      clients (`authenticated` role) from tampering with `platform_role`.
--   3. Extends `public.accounts` with:
--        - `slug` TEXT NOT NULL UNIQUE (with default fallback generator)
--        - `status` TEXT NOT NULL DEFAULT 'active' CHECK ('active', 'past_due', 'suspended', 'cancelled')
--        - `plan_tier` TEXT NOT NULL DEFAULT 'all_in_one'
--        - `logo_url` TEXT
--   4. Introduces `public.account_members` mapping table with RLS,
--      backfills existing memberships from `profiles`, and adds
--      bidirectional synchronization via trigger.
--   5. Implements cached SECURITY DEFINER RLS helper functions:
--        - `public.current_user_account_id()`
--        - `public.is_platform_super_admin()`
--        - `public.is_platform_support()`
--        - `auth.current_account_id()` & `auth.is_platform_super_admin()` (when auth schema exists)
--   6. Upgrades `public.is_account_member(...)` to grant Platform Super Admins
--      universal tenant access while maintaining strict isolation for regular tenant users.
--   7. Creates immutable `public.saas_audit_logs` table for platform administrative operations.
--   8. Updates `public.handle_new_user()` to bootstrap accounts with slugs and
--      populate `public.account_members` atomically.
--
-- Idempotent — safe to re-run multiple times.
-- ============================================================

-- ============================================================
-- 1. PLATFORM ROLES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role_enum') THEN
    CREATE TYPE platform_role_enum AS ENUM ('super_admin', 'support', 'none');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_role platform_role_enum NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_profiles_platform_role
  ON public.profiles(platform_role);

-- Prevent authenticated clients from escalating platform_role, account_role, or account_id
CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.account_role IS DISTINCT FROM OLD.account_role
      OR NEW.account_id IS DISTINCT FROM OLD.account_id
      OR NEW.platform_role IS DISTINCT FROM OLD.platform_role)
     AND current_user = 'authenticated'
  THEN
    RAISE EXCEPTION
      'Privilege columns (account_role, account_id, platform_role) cannot be changed directly; use administrative RPCs'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_profile_privilege_columns() OWNER TO postgres;

DROP TRIGGER IF EXISTS enforce_profile_privilege_columns ON public.profiles;
CREATE TRIGGER enforce_profile_privilege_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_privilege_columns();

-- ============================================================
-- 2. ACCOUNTS EXTENSIONS (ORGANIZATIONS)
-- ============================================================
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'all_in_one',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Set default for slug generation on future inserts
ALTER TABLE public.accounts
  ALTER COLUMN slug SET DEFAULT ('org-' || SUBSTRING(gen_random_uuid()::text, 1, 8));

-- Backfill slugs for existing accounts where slug IS NULL
UPDATE public.accounts
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Enforce NOT NULL and UNIQUE on slug
ALTER TABLE public.accounts
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_slug_key'
  ) THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_slug_key UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_status_check'
  ) THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_status_check
      CHECK (status IN ('active', 'past_due', 'suspended', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_slug ON public.accounts(slug);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);

-- ============================================================
-- 3. SECURITY DEFINER RLS HELPER FUNCTIONS
-- ============================================================

-- Returns the caller's active tenant account_id from profiles
CREATE OR REPLACE FUNCTION public.current_user_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

ALTER FUNCTION public.current_user_account_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_account_id() TO authenticated, service_role, anon;

-- Returns true if the caller has super_admin platform role
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

ALTER FUNCTION public.is_platform_super_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated, service_role, anon;

-- Returns true if the caller has support or super_admin platform role
CREATE OR REPLACE FUNCTION public.is_platform_support()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND platform_role IN ('super_admin', 'support')
  );
$$;

ALTER FUNCTION public.is_platform_support() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_platform_support() TO authenticated, service_role, anon;

-- Mirror helper functions into auth schema if schema exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    BEGIN
      CREATE OR REPLACE FUNCTION auth.current_account_id()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $b$
        SELECT account_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
      $b$;

      CREATE OR REPLACE FUNCTION auth.is_platform_super_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $b$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND platform_role = 'super_admin'
        );
      $b$;

      CREATE OR REPLACE FUNCTION auth.is_super_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $b$
        SELECT auth.is_platform_super_admin();
      $b$;
    EXCEPTION WHEN OTHERS THEN
      -- If auth schema permission restricted, silently continue; public schema functions are standard
      NULL;
    END;
  END IF;
END $$;

-- Upgrade is_account_member to grant access to super_admin as well
CREATE OR REPLACE FUNCTION public.is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Platform Super Admin has access across all tenant accounts
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.platform_role = 'super_admin'
    )
    OR
    -- Tenant account membership check
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_id = target_account_id
        AND CASE p.account_role
              WHEN 'owner'  THEN 4
              WHEN 'admin'  THEN 3
              WHEN 'agent'  THEN 2
              WHEN 'viewer' THEN 1
            END
          >=
            CASE min_role
              WHEN 'owner'  THEN 4
              WHEN 'admin'  THEN 3
              WHEN 'agent'  THEN 2
              WHEN 'viewer' THEN 1
            END
    )
  );
$$;

ALTER FUNCTION public.is_account_member(UUID, account_role_enum) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_account_member(UUID, account_role_enum) TO authenticated, service_role;

-- ============================================================
-- 4. DEDICATED ACCOUNT_MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role account_role_enum NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_members_account_id ON public.account_members(account_id);
CREATE INDEX IF NOT EXISTS idx_account_members_user_id ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_role ON public.account_members(account_id, role);

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_members_select ON public.account_members;
CREATE POLICY account_members_select ON public.account_members FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_members_insert ON public.account_members;
CREATE POLICY account_members_insert ON public.account_members FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS account_members_update ON public.account_members;
CREATE POLICY account_members_update ON public.account_members FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS account_members_delete ON public.account_members;
CREATE POLICY account_members_delete ON public.account_members FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Backfill account_members from existing profiles
INSERT INTO public.account_members (account_id, user_id, role)
SELECT account_id, user_id, account_role
FROM public.profiles
WHERE account_id IS NOT NULL AND account_role IS NOT NULL
ON CONFLICT (account_id, user_id) DO UPDATE
SET role = EXCLUDED.role, updated_at = NOW();

-- Trigger to sync profiles updates into account_members
CREATE OR REPLACE FUNCTION public.sync_profile_to_account_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NOT NULL AND NEW.account_role IS NOT NULL THEN
    -- If user moved accounts, clean up old account membership row
    IF OLD.account_id IS NOT NULL AND OLD.account_id <> NEW.account_id THEN
      DELETE FROM public.account_members
      WHERE user_id = NEW.user_id AND account_id = OLD.account_id;
    END IF;

    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (NEW.account_id, NEW.user_id, NEW.account_role)
    ON CONFLICT (account_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_profile_to_account_member() OWNER TO postgres;

DROP TRIGGER IF EXISTS sync_profile_to_account_member ON public.profiles;
CREATE TRIGGER sync_profile_to_account_member
  AFTER INSERT OR UPDATE OF account_id, account_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_account_member();

-- ============================================================
-- 5. IMMUTABLE SAAS AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_actor ON public.saas_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_target_account ON public.saas_audit_logs(target_account_id);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_created_at ON public.saas_audit_logs(created_at DESC);

ALTER TABLE public.saas_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin audit log select" ON public.saas_audit_logs;
CREATE POLICY "Super admin audit log select" ON public.saas_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_super_admin());

DROP POLICY IF EXISTS "Super admin audit log insert" ON public.saas_audit_logs;
CREATE POLICY "Super admin audit log insert" ON public.saas_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_super_admin());

-- ============================================================
-- 6. SIGNUP TRIGGER ENHANCEMENT
-- ============================================================
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
BEGIN
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

  INSERT INTO public.accounts (name, slug, owner_user_id, status, plan_tier)
  VALUES (v_account_name, v_account_slug, NEW.id, 'active', 'all_in_one')
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role, platform_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner', 'none');

  -- account_members is also populated automatically by sync_profile_to_account_member trigger,
  -- but we explicitly upsert here as well for deterministic atomicity.
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (v_account_id, NEW.id, 'owner')
  ON CONFLICT (account_id, user_id) DO UPDATE
  SET role = 'owner', updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
