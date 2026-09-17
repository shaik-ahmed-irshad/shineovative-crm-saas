import { NextRequest, NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { getBillingProvider } from "@/lib/billing";

/**
 * POST /api/billing/checkout
 *
 * Initiates an upgrade / checkout session for the All-In-One Plan.
 * Guarded by requireRole('admin') — only organization admins/owners may manage subscriptions.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole("admin");
    const body = await req.json().catch(() => ({}));

    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";
    const requestedCurrency =
      body.currency?.toUpperCase() === "INR" ? "INR" : "USD";

    // Resolve provider: default to customer preference or requested currency
    const provider = getBillingProvider(body.gateway || requestedCurrency);

    // Fetch user profile email & name
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", ctx.userId)
      .single();

    const customerEmail = profile?.email || "billing@shineovative.com";
    const customerName = profile?.full_name || ctx.account.name;

    const origin = req.nextUrl.origin || "http://localhost:3000";
    const successUrl = `${origin}/settings?tab=billing&payment=success`;
    const cancelUrl = `${origin}/settings?tab=billing&payment=cancelled`;

    const session = await provider.createCheckoutSession({
      accountId: ctx.accountId,
      customerEmail,
      customerName,
      billingCycle,
      currency: requestedCurrency,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
