// ============================================================
// Server-side account context — for API routes and server
// components. Reads the caller's profile + account in one round
// trip and verifies role on demand.
//
// IMPORTANT: this module is server-only. It imports the Supabase
// SSR client (`@/lib/supabase/server`), which reads `next/headers`
// cookies. Importing it from a client component will fail at
// build time with the standard Next.js "You're importing a
// component that needs `next/headers`" error — that's the
// boundary check; we don't need the `server-only` package.
//
// Calling convention
// ------------------
// API routes don't need to redo `supabase.auth.getUser()` — they
// receive a fully-loaded context from `requireRole`:
//
//   try {
//     const ctx = await requireRole("admin");
//     // ctx.supabase — the SSR client (RLS scoped to this user)
//     // ctx.userId  — auth.uid()
//     // ctx.accountId / ctx.role / ctx.account
//   } catch (err) {
//     return errorResponse(err); // see toErrorResponse() below
//   }
// ============================================================

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  hasMinRole,
  isAccountRole,
  isPlatformRole,
  isPlatformSupport,
  isSuperAdmin,
  type AccountRole,
  type PlatformRole,
} from "./roles";

// ------------------------------------------------------------
// Errors
//
// Custom classes so API routes can map a single `catch` to the
// right HTTP status without sprinkling 401/403 strings everywhere.
// ------------------------------------------------------------

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class PaymentRequiredError extends Error {
  readonly status = 402 as const;
  constructor(message = "Payment or active subscription required") {
    super(message);
    this.name = "PaymentRequiredError";
  }
}

/**
 * Convert one of the typed errors above (or anything else) into a
 * `NextResponse`. Routes can do:
 *
 *   } catch (err) {
 *     return toErrorResponse(err);
 *   }
 *
 * Unknown errors collapse to 500 with the generic message — we
 * never leak `err.message` for non-classified errors to keep
 * server internals out of the wire.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof PaymentRequiredError
  ) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[toErrorResponse] uncategorized error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// ------------------------------------------------------------
// Account context
// ------------------------------------------------------------

export interface AccountContext {
  /** Supabase SSR client, RLS scoped to the calling user. */
  supabase: SupabaseClient;
  /** `auth.uid()` for the caller. Always defined when this resolves. */
  userId: string;
  /** Caller's account_id from their profile row. */
  accountId: string;
  /** Caller's role within their account. */
  role: AccountRole;
  /** Platform-wide SaaS role ('super_admin' | 'support' | 'none'). */
  platformRole: PlatformRole;
  /** Lightweight account meta — id + name (+ slug, status, planTier). */
  account: {
    id: string;
    name: string;
    slug?: string;
    status?: string;
    planTier?: string;
  };
}

/**
 * Resolve the caller's user + account + role in one round trip.
 *
 * Throws `UnauthorizedError` if there's no Supabase session.
 * Throws `ForbiddenError` if the profile is missing account
 * fields (shouldn't happen post-017 migration; defensive guard
 * against profile rows that pre-date the backfill or were
 * inserted by hand).
 *
 * Use `requireRole(min)` instead when the route also needs a
 * minimum-role check — it's a thin wrapper over this.
 */
export async function getCurrentAccount(): Promise<AccountContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new UnauthorizedError();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("account_id, account_role, platform_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentAccount] profile fetch error:", error);
    throw new ForbiddenError("Could not load account context");
  }
  if (!data || !data.account_id || !data.account_role) {
    // Pre-migration profile, or a manual insert that skipped the
    // signup trigger. The user is authenticated but the app has
    // no way to scope their queries — treat as forbidden.
    throw new ForbiddenError("Profile is not linked to an account");
  }
  if (!isAccountRole(data.account_role)) {
    // The DB enum should make this impossible, but a future
    // migration that broadens the enum without updating TS would
    // hit this — surface it rather than silently widening.
    throw new ForbiddenError(`Unknown account role: ${data.account_role}`);
  }

  const platformRole: PlatformRole = isPlatformRole(data.platform_role)
    ? data.platform_role
    : "none";

  // Load the account with a plain point lookup by id rather than an
  // embedded FK join (`account:accounts!inner(...)`).
  const { data: account, error: accountErr } = await supabase
    .from("accounts")
    .select("id, name, slug, status, plan_tier")
    .eq("id", data.account_id)
    .maybeSingle();

  if (accountErr) {
    console.error("[getCurrentAccount] account fetch error:", accountErr);
    throw new ForbiddenError("Could not load account context");
  }
  if (!account) {
    // account_id points at no readable account row — orphaned profile
    // or an RLS gap. Same "can't scope this user" outcome as above.
    throw new ForbiddenError("Profile is not linked to an account");
  }

  return {
    supabase,
    userId: user.id,
    accountId: data.account_id,
    role: data.account_role,
    platformRole,
    account: {
      id: account.id,
      name: account.name,
      slug: account.slug,
      status: account.status,
      planTier: account.plan_tier,
    },
  };
}

/**
 * Resolve the caller's account context and enforce a minimum role.
 *
 * Throws `UnauthorizedError` / `ForbiddenError` as documented on
 * `getCurrentAccount`, plus `ForbiddenError("Insufficient role")`
 * when the caller is below `min`.
 */
export async function requireRole(min: AccountRole): Promise<AccountContext> {
  const ctx = await getCurrentAccount();
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`,
    );
  }
  return ctx;
}

/**
 * Resolve the caller's account context and verify Platform Super Admin role.
 *
 * Throws `ForbiddenError("Platform super-admin access required")` if
 * `platform_role !== 'super_admin'`.
 */
export async function requireSuperAdmin(): Promise<AccountContext> {
  const ctx = await getCurrentAccount();
  if (!isSuperAdmin(ctx.platformRole)) {
    throw new ForbiddenError("Platform super-admin access required");
  }
  return ctx;
}

/**
 * Resolve the caller's account context and verify Platform Support or Super Admin role.
 */
export async function requirePlatformSupport(): Promise<AccountContext> {
  const ctx = await getCurrentAccount();
  if (!isPlatformSupport(ctx.platformRole)) {
    throw new ForbiddenError("Platform administrative access required");
  }
  return ctx;
}

/**
 * Verify that the tenant organization has an active or trialing subscription.
 *
 * Throws ForbiddenError if the organization is suspended.
 * Throws PaymentRequiredError (402) if the subscription is cancelled.
 */
export function requireActiveSubscription(ctx: AccountContext): void {
  const status = ctx.account.status;
  if (status === "suspended") {
    throw new ForbiddenError(
      "Your organization account has been suspended by platform administration. Please contact support.",
    );
  }
  if (status === "cancelled") {
    throw new PaymentRequiredError(
      "Your subscription is cancelled or inactive. Please renew your plan to send messages.",
    );
  }
}


