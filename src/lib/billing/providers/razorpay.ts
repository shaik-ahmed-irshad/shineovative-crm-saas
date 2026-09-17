import crypto from "crypto";
import { getSmallestUnitAmount } from "../pricing";
import type {
  BillingProvider,
  CreateCheckoutSessionParams,
  CheckoutSessionResult,
  WebhookVerificationResult,
} from "../types";

export class RazorpayProvider implements BillingProvider {
  readonly gateway = "razorpay" as const;

  private get keyId(): string | undefined {
    return process.env.RAZORPAY_KEY_ID;
  }

  private get keySecret(): string | undefined {
    return process.env.RAZORPAY_KEY_SECRET;
  }

  private get webhookSecret(): string | undefined {
    return process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  async createCustomer(accountId: string, email: string, name: string): Promise<string> {
    if (!this.keyId || !this.keySecret) {
      return `cust_mock_rp_${accountId.slice(0, 8)}`;
    }

    try {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          notes: { accountId },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.description || "Failed to create Razorpay customer");
      }

      const data = await res.json();
      return data.id;
    } catch (err) {
      console.error("[RazorpayProvider] createCustomer error:", err);
      return `cust_mock_rp_${accountId.slice(0, 8)}`;
    }
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    const amount = getSmallestUnitAmount(params.billingCycle, "INR");

    if (!this.keyId || !this.keySecret) {
      // Mock / Dry-run checkout order for local testing & development
      const mockOrderId = `order_mock_rp_${Date.now()}`;
      const successWithParam = new URL(params.successUrl);
      successWithParam.searchParams.set("order_id", mockOrderId);
      successWithParam.searchParams.set("gateway", "razorpay");

      return {
        gateway: "razorpay",
        sessionId: mockOrderId,
        razorpayOrderId: mockOrderId,
        razorpayKeyId: "rzp_test_mockkey123",
        checkoutUrl: successWithParam.toString(),
        amount,
        currency: "INR",
      };
    }

    try {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount, // in paise
          currency: "INR",
          receipt: `rcpt_${params.accountId.slice(0, 8)}_${Date.now()}`,
          notes: {
            accountId: params.accountId,
            billingCycle: params.billingCycle,
            customerEmail: params.customerEmail,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.description || "Failed to create Razorpay order");
      }

      const order = await res.json();
      return {
        gateway: "razorpay",
        sessionId: order.id,
        razorpayOrderId: order.id,
        razorpayKeyId: this.keyId,
        amount,
        currency: "INR",
      };
    } catch (err) {
      console.error("[RazorpayProvider] createCheckoutSession error:", err);
      return {
        gateway: "razorpay",
        sessionId: `order_fallback_${Date.now()}`,
        razorpayOrderId: `order_fallback_${Date.now()}`,
        amount,
        currency: "INR",
      };
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    if (!this.keyId || !this.keySecret || subscriptionId.startsWith("sub_mock_")) {
      return true;
    }

    try {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
      const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      });
      return res.ok;
    } catch (err) {
      console.error("[RazorpayProvider] cancelSubscription error:", err);
      return false;
    }
  }

  verifyWebhook(payload: string, signature: string, customSecret?: string): WebhookVerificationResult {
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
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex"),
      );

      if (!isValid) {
        return { valid: false, error: "Razorpay signature verification failed" };
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
    const eventName = parsed?.event || "unknown";
    const payloadObj = parsed?.payload?.payment?.entity || parsed?.payload?.subscription?.entity || {};

    return {
      type: eventName,
      gateway: "razorpay" as const,
      accountId: payloadObj.notes?.accountId,
      customerId: payloadObj.customer_id,
      subscriptionId: payloadObj.subscription_id || (payloadObj.entity === "subscription" ? payloadObj.id : undefined),
      invoiceId: payloadObj.invoice_id || payloadObj.id,
      amountPaid: payloadObj.amount,
      currency: "INR" as const,
      receiptUrl: payloadObj.notes?.receipt_url,
      raw: parsed,
    };
  }
}
