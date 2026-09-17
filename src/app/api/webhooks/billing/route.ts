import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBillingProvider } from "@/lib/billing";

// Lazy-init service client for webhook updates
let _adminClient: any = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _adminClient;
}

/**
 * POST /api/webhooks/billing
 *
 * Unified webhook endpoint for Stripe and Razorpay.
 * Cryptographically verifies signatures and executes subscription state transitions.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const stripeSig = req.headers.get("stripe-signature");
    const razorpaySig = req.headers.get("x-razorpay-signature");

    let gateway: "stripe" | "razorpay";
    let signature: string;

    if (stripeSig) {
      gateway = "stripe";
      signature = stripeSig;
    } else if (razorpaySig) {
      gateway = "razorpay";
      signature = razorpaySig;
    } else {
      // If no signature header is provided in non-production, check for test event
      if (process.env.NODE_ENV !== "production") {
        gateway = "stripe";
        signature = "";
      } else {
        return NextResponse.json(
          { error: "Missing billing provider signature header" },
          { status: 400 },
        );
      }
    }

    const provider = getBillingProvider(gateway);
    const verification = provider.verifyWebhook(rawBody, signature);

    if (!verification.valid || !verification.event) {
      console.error(`[webhooks/billing] ${gateway} verification failed:`, verification.error);
      return NextResponse.json(
        { error: verification.error || "Invalid webhook signature" },
        { status: 400 },
      );
    }

    const event = verification.event;
    const supabase = getAdminClient();

    // Resolve target account ID: from event metadata or by customer_id / subscription_id lookup
    let targetAccountId = event.accountId;

    if (!targetAccountId && (event.customerId || event.subscriptionId)) {
      const query = supabase
        .from("subscriptions")
        .select("account_id")
        .eq("gateway", gateway);

      if (event.subscriptionId) {
        query.eq("subscription_id", event.subscriptionId);
      } else if (event.customerId) {
        query.eq("customer_id", event.customerId);
      }

      const { data: matched } = await query.maybeSingle();
      if (matched) {
        targetAccountId = matched.account_id;
      }
    }

    if (!targetAccountId) {
      console.warn("[webhooks/billing] Unresolvable account for event:", event.type);
      return NextResponse.json({ received: true, warning: "Account unresolvable" });
    }

    const now = new Date();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "webhook";

    // Handle Event Lifecycle States
    switch (event.type) {
      // 1. Successful payment & activation
      case "checkout.session.completed":
      case "subscription.authenticated":
      case "order.paid":
      case "invoice.paid":
      case "subscription.charged": {
        // Extend period by 30 days or 365 days
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await supabase.from("subscriptions").upsert(
          {
            account_id: targetAccountId,
            gateway: gateway,
            customer_id: event.customerId || null,
            subscription_id: event.subscriptionId || null,
            plan_code: "all_in_one",
            status: "active",
            currency: event.currency || "USD",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
            updated_at: now.toISOString(),
          },
          { onConflict: "account_id" },
        );

        // Update organization status to active
        await supabase
          .from("accounts")
          .update({ status: "active", updated_at: now.toISOString() })
          .eq("id", targetAccountId);

        // Record paid invoice
        if (event.amountPaid) {
          await supabase.from("billing_invoices").insert({
            account_id: targetAccountId,
            gateway: gateway,
            invoice_id: event.invoiceId || `inv_${Date.now()}`,
            amount_paid: event.amountPaid,
            currency: event.currency || "USD",
            receipt_url: event.receiptUrl || null,
            paid_at: now.toISOString(),
          });
        }

        // Audit log
        await supabase.from("saas_audit_logs").insert({
          actor_email: `${gateway}-webhook`,
          action: "billing.payment_received",
          target_account_id: targetAccountId,
          details: {
            event_type: event.type,
            amount: event.amountPaid,
            currency: event.currency,
            subscription_id: event.subscriptionId,
          },
          ip_address: ipAddress,
        });
        break;
      }

      // 2. Payment Failure (Grace Period)
      case "invoice.payment_failed":
      case "payment.failed": {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: now.toISOString() })
          .eq("account_id", targetAccountId);

        await supabase
          .from("accounts")
          .update({ status: "past_due", updated_at: now.toISOString() })
          .eq("id", targetAccountId);

        await supabase.from("saas_audit_logs").insert({
          actor_email: `${gateway}-webhook`,
          action: "billing.payment_failed",
          target_account_id: targetAccountId,
          details: {
            event_type: event.type,
            subscription_id: event.subscriptionId,
          },
          ip_address: ipAddress,
        });
        break;
      }

      // 3. Subscription Cancellation
      case "customer.subscription.deleted":
      case "subscription.cancelled": {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: now.toISOString() })
          .eq("account_id", targetAccountId);

        await supabase
          .from("accounts")
          .update({ status: "cancelled", updated_at: now.toISOString() })
          .eq("id", targetAccountId);

        await supabase.from("saas_audit_logs").insert({
          actor_email: `${gateway}-webhook`,
          action: "billing.subscription_cancelled",
          target_account_id: targetAccountId,
          details: {
            event_type: event.type,
            subscription_id: event.subscriptionId,
          },
          ip_address: ipAddress,
        });
        break;
      }

      default:
        console.log(`[webhooks/billing] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhooks/billing] Error processing webhook:", err);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
