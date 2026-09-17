import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

/**
 * GET /api/account/onboarding
 *
 * Returns current tenant organization profile and onboarding status.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    const { data: account, error: accountErr } = await ctx.supabase
      .from("accounts")
      .select("id, name, slug, default_currency, timezone, onboarding_completed_at, status, logo_url")
      .eq("id", ctx.accountId)
      .single();

    if (accountErr || !account) {
      return NextResponse.json({ error: "Could not load account details" }, { status: 404 });
    }

    const { data: waConfig } = await ctx.supabase
      .from("whatsapp_config")
      .select("status, phone_number_id")
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    return NextResponse.json({
      account: {
        id: account.id,
        name: account.name,
        slug: account.slug,
        defaultCurrency: account.default_currency || "USD",
        timezone: account.timezone || "Asia/Kolkata",
        logoUrl: account.logo_url,
        status: account.status,
        onboardingCompleted: !!account.onboarding_completed_at,
      },
      whatsapp: {
        connected: waConfig?.status === "connected",
        phoneNumberId: waConfig?.phone_number_id || null,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/account/onboarding
 *
 * Saves onboarding step configuration and marks onboarding completed.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getCurrentAccount();
    const body = await req.json();

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }

    if (typeof body.defaultCurrency === "string" && body.defaultCurrency.trim()) {
      const currency = body.defaultCurrency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        return NextResponse.json(
          { error: "Currency must be a valid 3-letter ISO code" },
          { status: 400 },
        );
      }
      updates.default_currency = currency;
    }

    if (typeof body.timezone === "string" && body.timezone.trim()) {
      updates.timezone = body.timezone.trim();
    }

    if (typeof body.logoUrl === "string") {
      updates.logo_url = body.logoUrl.trim() || null;
    }

    if (body.complete === true) {
      updates.onboarding_completed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await ctx.supabase
        .from("accounts")
        .update(updates)
        .eq("id", ctx.accountId);

      if (updateErr) {
        console.error("[onboarding] update error:", updateErr);
        return NextResponse.json(
          { error: "Failed to update organization onboarding settings" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      onboardingCompleted: !!updates.onboarding_completed_at,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
