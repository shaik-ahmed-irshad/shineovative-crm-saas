import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  calculateAnnualSavings,
  calculateTrialDaysRemaining,
  getDisplayAmount,
  getSmallestUnitAmount,
  isSubscriptionActive,
  isWithinGracePeriod,
} from "./pricing";
import { getBillingProvider, StripeProvider, RazorpayProvider } from "./index";
import {
  ForbiddenError,
  PaymentRequiredError,
  requireActiveSubscription,
  type AccountContext,
} from "../auth/account";

/**
 * SaaS Single Subscription & Unified Billing Engine Test Suite
 *
 * Validates specifications defined in:
 * - docs/saas/SAAS_BILLING_AND_TIERS_SPEC.md
 * - Milestone 4: Single Subscription & Unified Billing Engine
 */
describe("SaaS Single Subscription & Billing Engine", () => {
  describe("1. Pricing & Currency Calculations", () => {
    it("returns correct amounts in smallest unit (paise) for INR", () => {
      // Monthly: ₹2,999 = 299,900 paise
      expect(getSmallestUnitAmount("monthly", "INR")).toBe(299900);
      // Annual: ₹28,790 = 2,879,000 paise
      expect(getSmallestUnitAmount("annual", "INR")).toBe(2879000);
    });

    it("returns correct amounts in smallest unit (cents) for USD", () => {
      // Monthly: $39 = 3,900 cents
      expect(getSmallestUnitAmount("monthly", "USD")).toBe(3900);
      // Annual: $375 = 37,500 cents
      expect(getSmallestUnitAmount("annual", "USD")).toBe(37500);
    });

    it("formats display amounts accurately", () => {
      expect(getDisplayAmount("monthly", "INR")).toBe("₹2,999");
      expect(getDisplayAmount("annual", "INR")).toBe("₹28,790");
      expect(getDisplayAmount("monthly", "USD")).toBe("$39");
      expect(getDisplayAmount("annual", "USD")).toBe("$375");
    });

    it("calculates exactly 20% annual savings for both currencies", () => {
      const savingsINR = calculateAnnualSavings("INR");
      expect(savingsINR.savingsPercent).toBe(20);
      // 2,999 * 12 = 35,988. 35,988 - 28,790 = 7,198 saved
      expect(savingsINR.savingsAmount).toBe(7198);

      const savingsUSD = calculateAnnualSavings("USD");
      expect(savingsUSD.savingsPercent).toBe(20);
      // 39 * 12 = 468. 468 - 375 = 93 saved
      expect(savingsUSD.savingsAmount).toBe(93);
    });
  });

  describe("2. Trial & Subscription Lifecycle Logic", () => {
    it("calculates remaining trial days correctly", () => {
      const now = Date.now();
      const in10Days = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
      const in2Hours = new Date(now + 2 * 60 * 60 * 1000).toISOString();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      expect(calculateTrialDaysRemaining(in10Days)).toBe(10);
      expect(calculateTrialDaysRemaining(in2Hours)).toBe(1); // rounded up to 1 day
      expect(calculateTrialDaysRemaining(yesterday)).toBe(0);
      expect(calculateTrialDaysRemaining(null)).toBe(0);
      expect(calculateTrialDaysRemaining(undefined)).toBe(0);
    });

    it("validates that both 'trialing' and 'active' grant operational access", () => {
      expect(isSubscriptionActive("active")).toBe(true);
      expect(isSubscriptionActive("trialing")).toBe(true);
      expect(isSubscriptionActive("past_due")).toBe(false);
      expect(isSubscriptionActive("cancelled")).toBe(false);
      expect(isSubscriptionActive("unpaid")).toBe(false);
      expect(isSubscriptionActive(null)).toBe(false);
    });

    it("identifies grace period for past_due status (3 days default)", () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
      const fourDaysAgo = new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString();

      expect(isWithinGracePeriod("past_due", oneDayAgo, 3)).toBe(true);
      expect(isWithinGracePeriod("past_due", fourDaysAgo, 3)).toBe(false);
      expect(isWithinGracePeriod("cancelled", oneDayAgo, 3)).toBe(false);
    });
  });

  describe("3. Unified Billing Provider Routing", () => {
    it("routes INR and razorpay requests to RazorpayProvider", () => {
      const p1 = getBillingProvider("INR");
      expect(p1.gateway).toBe("razorpay");
      expect(p1).toBeInstanceOf(RazorpayProvider);

      const p2 = getBillingProvider("razorpay");
      expect(p2.gateway).toBe("razorpay");
    });

    it("routes USD, stripe and default requests to StripeProvider", () => {
      const p1 = getBillingProvider("USD");
      expect(p1.gateway).toBe("stripe");
      expect(p1).toBeInstanceOf(StripeProvider);

      const p2 = getBillingProvider("stripe");
      expect(p2.gateway).toBe("stripe");

      const p3 = getBillingProvider(null);
      expect(p3.gateway).toBe("stripe");
    });
  });

  describe("4. Webhook Cryptographic Signatures (HMAC SHA-256)", () => {
    const testSecret = "whsec_test_secret_key_1234567890";

    it("verifies authentic Stripe webhook signature", () => {
      const provider = new StripeProvider();
      const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_123",
            customer: "cus_123",
            client_reference_id: "org-uuid-1",
            amount_total: 3900,
          },
        },
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(signedPayload)
        .digest("hex");

      const header = `t=${timestamp},v1=${signature}`;
      const result = provider.verifyWebhook(payload, header, testSecret);

      expect(result.valid).toBe(true);
      expect(result.event?.type).toBe("checkout.session.completed");
      expect(result.event?.accountId).toBe("org-uuid-1");
      expect(result.event?.customerId).toBe("cus_123");
    });

    it("rejects forged Stripe webhook signature", () => {
      const provider = new StripeProvider();
      const payload = JSON.stringify({ type: "invoice.paid" });
      const header = "t=12345,v1=badsignature00000000000000000000000000000000000000000000000000000000";

      const result = provider.verifyWebhook(payload, header, testSecret);
      expect(result.valid).toBe(false);
    });

    it("verifies authentic Razorpay webhook signature", () => {
      const provider = new RazorpayProvider();
      const payload = JSON.stringify({
        event: "order.paid",
        payload: {
          payment: {
            entity: {
              id: "pay_123",
              amount: 299900,
              notes: { accountId: "org-uuid-2" },
            },
          },
        },
      });

      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(payload)
        .digest("hex");

      const result = provider.verifyWebhook(payload, signature, testSecret);
      expect(result.valid).toBe(true);
      expect(result.event?.type).toBe("order.paid");
      expect(result.event?.accountId).toBe("org-uuid-2");
      expect(result.event?.amountPaid).toBe(299900);
    });

    it("rejects forged Razorpay webhook signature", () => {
      const provider = new RazorpayProvider();
      const payload = JSON.stringify({ event: "payment.failed" });
      const badSig = "0000000000000000000000000000000000000000000000000000000000000000";

      const result = provider.verifyWebhook(payload, badSig, testSecret);
      expect(result.valid).toBe(false);
    });
  });

  describe("5. Outbound WhatsApp Access Enforcement", () => {
    function makeCtx(status: string): AccountContext {
      return {
        supabase: {} as any,
        userId: "user-1",
        accountId: "acc-1",
        role: "agent",
        platformRole: "none",
        account: {
          id: "acc-1",
          name: "Test Org",
          status,
        },
      };
    }

    it("allows active account to send messages", () => {
      expect(() => requireActiveSubscription(makeCtx("active"))).not.toThrow();
    });

    it("allows trialing account to send messages", () => {
      expect(() => requireActiveSubscription(makeCtx("trialing"))).not.toThrow();
    });

    it("allows past_due account during grace period", () => {
      expect(() => requireActiveSubscription(makeCtx("past_due"))).not.toThrow();
    });

    it("throws ForbiddenError when account is suspended", () => {
      expect(() => requireActiveSubscription(makeCtx("suspended"))).toThrow(ForbiddenError);
    });

    it("throws PaymentRequiredError (402) when subscription is cancelled", () => {
      expect(() => requireActiveSubscription(makeCtx("cancelled"))).toThrow(PaymentRequiredError);
      try {
        requireActiveSubscription(makeCtx("cancelled"));
      } catch (err: any) {
        expect(err.status).toBe(402);
      }
    });
  });
});
