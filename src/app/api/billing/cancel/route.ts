import { NextRequest, NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { getBillingProvider } from "@/lib/billing";

/**
 * POST /api/billing/cancel
 *
 * Cancels auto-renewal at the end of the current billing cycle.
 * Guarded strictly by requireRole('owner').
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole("owner");

    // Fetch active subscription
    const { data: sub, error: fetchErr } = await ctx.supabase
      .from("subscriptions")
      .select("*")
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (fetchErr || !sub) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    // Call provider cancel if real subscription exists
    if (sub.subscription_id) {
      const provider = getBillingProvider(sub.gateway);
      await provider.cancelSubscription(sub.subscription_id);
    }

    // Mark cancel_at_period_end
    await ctx.supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("account_id", ctx.accountId);

    // Write audit log
    await ctx.supabase.from("saas_audit_logs").insert({
      actor_user_id: ctx.userId,
      actor_email: "owner",
      action: "billing.cancel_auto_renew",
      target_account_id: ctx.accountId,
      details: {
        subscription_id: sub.subscription_id,
        gateway: sub.gateway,
        current_period_end: sub.current_period_end,
      },
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
    });

    return NextResponse.json({
      ok: true,
      message: "Subscription will cancel at the end of the current billing period.",
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
