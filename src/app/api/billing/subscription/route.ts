import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import {
  calculateTrialDaysRemaining,
  isSubscriptionActive,
} from "@/lib/billing/pricing";
import { getPricingForCurrency } from "@/config/pricing";

/**
 * GET /api/billing/subscription
 *
 * Fetches the tenant's current subscription status, trial timeline, and invoice history.
 */
export async function GET(_req: NextRequest) {
  try {
    const ctx = await getCurrentAccount();

    // 1. Fetch Subscription record
    const { data: sub, error: subErr } = await ctx.supabase
      .from("subscriptions")
      .select("*")
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (subErr) {
      console.error("[billing/subscription] error fetching subscription:", subErr);
    }

    // 2. Fetch past payment invoices
    const { data: invoices, error: invErr } = await ctx.supabase
      .from("billing_invoices")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("paid_at", { ascending: false })
      .limit(20);

    if (invErr) {
      console.error("[billing/subscription] error fetching invoices:", invErr);
    }

    // Default to account status or trialing if subscription row hasn't been created yet
    const currentStatus = sub?.status || (ctx.account.status as any) || "trialing";
    const trialEndsAt = sub?.trial_ends_at || null;
    const trialDaysRemaining = calculateTrialDaysRemaining(trialEndsAt);
    const active = isSubscriptionActive(currentStatus);
    const currency = (sub?.currency || "USD") as "INR" | "USD";

    return NextResponse.json({
      subscription: sub || {
        account_id: ctx.accountId,
        gateway: currency === "INR" ? "razorpay" : "stripe",
        plan_code: "all_in_one",
        billing_cycle: "monthly",
        currency,
        status: currentStatus,
        trial_ends_at: trialEndsAt,
        cancel_at_period_end: false,
      },
      status: currentStatus,
      isActive: active,
      trialDaysRemaining,
      invoices: invoices || [],
      pricing: getPricingForCurrency(currency),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
