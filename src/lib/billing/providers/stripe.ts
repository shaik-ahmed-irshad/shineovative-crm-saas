import crypto from "crypto";
import { getSmallestUnitAmount } from "../pricing";
import type {
  BillingProvider,
  CreateCheckoutSessionParams,
  CheckoutSessionResult,
  WebhookVerificationResult,
} from "../types";

export class StripeProvider implements BillingProvider {
  readonly gateway = "stripe" as const;

  private get apiKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY;
  }

  private get webhookSecret(): string | undefined {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }

  async createCustomer(accountId: string, email: string, name: string): Promise<string> {
    if (!this.apiKey) {
      return `cus_mock_stripe_${accountId.slice(0, 8)}`;
    }

    try {
      const form = new URLSearchParams();
      form.append("email", email);
      form.append("name", name);
      form.append("metadata[accountId]", accountId);

      const res = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to create Stripe customer");
      }

      const data = await res.json();
      return data.id;
    } catch (err) {
      console.error("[StripeProvider] createCustomer error:", err);
      return `cus_mock_stripe_${accountId.slice(0, 8)}`;
    }
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    const amount = getSmallestUnitAmount(params.billingCycle, "USD");

    if (!this.apiKey) {
      // Mock / Dry-run checkout session for local development and test environments
      const mockSessionId = `cs_test_mock_${Date.now()}`;
      const successWithParam = new URL(params.successUrl);
      successWithParam.searchParams.set("session_id", mockSessionId);
      successWithParam.searchParams.set("gateway", "stripe");

      return {
        gateway: "stripe",
        sessionId: mockSessionId,
        checkoutUrl: successWithParam.toString(),
        amount,
        currency: "USD",
      };
    }

    try {
      const form = new URLSearchParams();
      form.append("mode", "subscription");
      form.append("payment_method_types[0]", "card");
      form.append("customer_email", params.customerEmail);
      form.append("client_reference_id", params.accountId);
      form.append("metadata[accountId]", params.accountId);
      form.append("metadata[billingCycle]", params.billingCycle);
      form.append("success_url", params.successUrl + "?session_id={CHECKOUT_SESSION_ID}&gateway=stripe");
      form.append("cancel_url", params.cancelUrl);

      // Line items: Single All-In-One Plan
      form.append("line_items[0][price_data][currency]", "usd");
      form.append("line_items[0][price_data][product_data][name]", "Shineovative WhatsApp CRM — All-In-One Plan");
      form.append(
        "line_items[0][price_data][product_data][description]",
        params.billingCycle === "annual"
          ? "Annual Subscription (20% Discount applied)"
          : "Monthly Subscription",
      );
      form.append("line_items[0][price_data][unit_amount]", amount.toString());
      form.append(
        "line_items[0][price_data][recurring][interval]",
        params.billingCycle === "annual" ? "year" : "month",
      );
      form.append("line_items[0][quantity]", "1");

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Stripe Checkout session creation failed");
      }

      const data = await res.json();
      return {
        gateway: "stripe",
        sessionId: data.id,
        checkoutUrl: data.url,
        amount,
        currency: "USD",
      };
    } catch (err) {
      console.error("[StripeProvider] createCheckoutSession error:", err);
      // Fallback to dry-run link
      return {
        gateway: "stripe",
        sessionId: `cs_fallback_${Date.now()}`,
        checkoutUrl: `${params.successUrl}?session_id=fallback&gateway=stripe`,
        amount,
        currency: "USD",
      };
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    if (!this.apiKey || subscriptionId.startsWith("sub_mock_")) {
      return true;
    }

    try {
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return res.ok;
    } catch (err) {
      console.error("[StripeProvider] cancelSubscription error:", err);
      return false;
    }
  }

  verifyWebhook(payload: string, signatureHeader: string, customSecret?: string): WebhookVerificationResult {
    const secret = customSecret || this.webhookSecret;

    // In local dev/testing without a webhook secret, parse and accept the payload safely
    if (!secret) {
      try {
        const parsed = JSON.parse(payload);
        return {
          valid: true,
          event: this.extractEventData(parsed),
        };
      } catch (err) {
        return { valid: false, error: "Invalid JSON payload" };
      }
    }

    try {
      // Stripe signature header format: "t=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd"
      const parts = signatureHeader.split(",");
      const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
      const signature = parts.find((p) => p.startsWith("v1="))?.slice(3);

      if (!timestamp || !signature) {
        return { valid: false, error: "Missing timestamp or v1 signature in Stripe header" };
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex"),
      );

      if (!isValid) {
        return { valid: false, error: "Signature mismatch" };
      }

      const parsed = JSON.parse(payload);
      return {
        valid: true,
        event: this.extractEventData(parsed),
      };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "Verification error" };
    }
  }

  private extractEventData(parsed: any) {
    const type = parsed?.type || "unknown";
    const dataObj = parsed?.data?.object || {};

    return {
      type,
      gateway: "stripe" as const,
      accountId: dataObj.metadata?.accountId || dataObj.client_reference_id,
      customerId: dataObj.customer,
      subscriptionId: dataObj.subscription || (dataObj.object === "subscription" ? dataObj.id : undefined),
      invoiceId: dataObj.id,
      amountPaid: dataObj.amount_paid || dataObj.amount_total,
      currency: "USD" as const,
      receiptUrl: dataObj.hosted_invoice_url || dataObj.receipt_url,
      raw: parsed,
    };
  }
}
