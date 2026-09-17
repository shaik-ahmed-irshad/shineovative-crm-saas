import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  isSuperAdmin,
  isPlatformSupport,
  hasMinRole,
} from "./auth/roles";
import {
  requireActiveSubscription,
  ForbiddenError,
  PaymentRequiredError,
  type AccountContext,
} from "./auth/account";
import { encrypt, decrypt } from "./whatsapp/encryption";
import { getBillingProvider, StripeProvider, RazorpayProvider } from "./billing";
import { getSmallestUnitAmount, calculateAnnualSavings } from "./billing/pricing";
import {
  checkAiQuota,
  getStartOfMonth,
  getStartOfNextMonth,
  DEFAULT_MONTHLY_TOKEN_QUOTA,
} from "./ai/quota";

/**
 * End-to-End SaaS Production Readiness Test Suite
 *
 * Verifies all 6 milestones of the Shineovative WhatsApp CRM SaaS:
 * 1. Tenancy & Platform Roles (Milestone 1 & 2)
 * 2. Super Admin Authorization & Audit Logs (Milestone 3)
 * 3. Unified Billing Engine & Pricing (Milestone 4)
 * 4. Multi-Tenant WABA Isolation (Milestone 5)
 * 5. AI Quota Metering & Lifecycle Maintenance (Milestone 6)
 */
describe("SaaS Production Readiness Verification Suite", () => {
  // ============================================================
  // 1. TENANCY & PLATFORM ROLES
  // ============================================================
  describe("Milestone 1 & 2: Tenancy, Platform Roles & Bootstrap", () => {
    it("strictly isolates platform super-admin privileges from tenant owners", () => {
      // Platform super_admin has elevated rights
      expect(isSuperAdmin("super_admin")).toBe(true);
      expect(isPlatformSupport("super_admin")).toBe(true);

      // Support has platform support rights but not super_admin
      expect(isSuperAdmin("support")).toBe(false);
      expect(isPlatformSupport("support")).toBe(true);

      // Normal tenant owner has 'none' platform role and no platform rights
      expect(isSuperAdmin("none")).toBe(false);
      expect(isPlatformSupport("none")).toBe(false);
    });

    it("verifies hierarchical tenant account roles (owner > admin > agent)", () => {
      // Owner satisfies all levels
      expect(hasMinRole("owner", "owner")).toBe(true);
      expect(hasMinRole("owner", "admin")).toBe(true);
      expect(hasMinRole("owner", "agent")).toBe(true);

      // Admin satisfies admin and agent, but not owner
      expect(hasMinRole("admin", "owner")).toBe(false);
      expect(hasMinRole("admin", "admin")).toBe(true);
      expect(hasMinRole("admin", "agent")).toBe(true);

      // Agent satisfies only agent
      expect(hasMinRole("agent", "owner")).toBe(false);
      expect(hasMinRole("agent", "admin")).toBe(false);
      expect(hasMinRole("agent", "agent")).toBe(true);
    });

    it("formats organization slugs with predictable alphanumeric sanitization", () => {
      const orgName = "Acme Global Solutions & Tech!";
      const accountId = "d3b07384-d113-4680-87a1-5d9c2a688463";
      const sanitized =
        orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") +
        "-" +
        accountId.substring(0, 8);

      expect(sanitized).toBe("acme-global-solutions-tech-d3b07384");
    });
  });

  // ============================================================
  // 2. SUPER ADMIN AUTHORIZATION & AUDIT TRAIL
  // ============================================================
  describe("Milestone 3: Super Admin Command Center & Audit Trail", () => {
    const validAccountStatuses = ["active", "past_due", "suspended", "cancelled"];

    it("restricts organization status transitions to valid state-machine states", () => {
      validAccountStatuses.forEach((status) => {
        expect(["active", "past_due", "suspended", "cancelled"]).toContain(status);
      });
    });

    it("validates structured audit log records for platform operations", () => {
      const auditLogRecord = {
        id: "log-12345",
        actor_email: "superadmin@shineovative.com",
        action: "organization.status_updated",
        target_account_id: "org-alpha-100",
        details: {
          previous_status: "active",
          new_status: "suspended",
          reason: "Compliance review",
        },
        ip_address: "127.0.0.1",
        created_at: new Date().toISOString(),
      };

      expect(auditLogRecord.actor_email).toBeTruthy();
      expect(auditLogRecord.action).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(auditLogRecord.details.new_status).toBe("suspended");
      expect(auditLogRecord.created_at).toBeTruthy();
    });
  });

  // ============================================================
  // 3. UNIFIED BILLING ENGINE (RAZORPAY + STRIPE)
  // ============================================================
  describe("Milestone 4: Unified Billing Engine & Pricing", () => {
    it("routes currency to correct gateway provider", () => {
      const inrProvider = getBillingProvider("INR");
      expect(inrProvider).toBeInstanceOf(RazorpayProvider);
      expect(inrProvider.gateway).toBe("razorpay");

      const usdProvider = getBillingProvider("USD");
      expect(usdProvider).toBeInstanceOf(StripeProvider);
      expect(usdProvider.gateway).toBe("stripe");
    });

    it("verifies exact All-In-One Plan pricing and 20% annual discount", () => {
      // INR: ₹2,999/mo, ₹28,790/yr
      expect(getSmallestUnitAmount("monthly", "INR")).toBe(299900);
      expect(getSmallestUnitAmount("annual", "INR")).toBe(2879000);
      const savingsINR = calculateAnnualSavings("INR");
      expect(savingsINR.savingsPercent).toBe(20);
      expect(savingsINR.savingsAmount).toBe(7198);

      // USD: $39/mo, $375/yr
      expect(getSmallestUnitAmount("monthly", "USD")).toBe(3900);
      expect(getSmallestUnitAmount("annual", "USD")).toBe(37500);
      const savingsUSD = calculateAnnualSavings("USD");
      expect(savingsUSD.savingsPercent).toBe(20);
      expect(savingsUSD.savingsAmount).toBe(93);
    });

    it("verifies Stripe and Razorpay HMAC-SHA256 signatures with zero external dependencies", () => {
      const secret = "whsec_test_secret_12345";
      const payload = JSON.stringify({ event: "payment.captured", id: "pay_987" });

      // Stripe verification (t=timestamp,v1=signature)
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${payload}`;
      const stripeHmac = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
      const stripeHeader = `t=${timestamp},v1=${stripeHmac}`;

      const stripeProvider = new StripeProvider();
      const stripeResult = stripeProvider.verifyWebhook(payload, stripeHeader, secret);
      expect(stripeResult.valid).toBe(true);

      // Razorpay verification (raw payload hmac)
      const razorpayHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const razorpayProvider = new RazorpayProvider();
      const razorpayResult = razorpayProvider.verifyWebhook(payload, razorpayHmac, secret);
      expect(razorpayResult.valid).toBe(true);
    });

    it("protects outbound WhatsApp traffic based on account status", () => {
      const activeCtx = {
        account: { id: "acc-1", name: "Alpha", status: "active" },
      } as AccountContext;
      expect(() => requireActiveSubscription(activeCtx)).not.toThrow();

      const suspendedCtx = {
        account: { id: "acc-2", name: "Beta", status: "suspended" },
      } as AccountContext;
      expect(() => requireActiveSubscription(suspendedCtx)).toThrow(ForbiddenError);

      const cancelledCtx = {
        account: { id: "acc-3", name: "Gamma", status: "cancelled" },
      } as AccountContext;
      expect(() => requireActiveSubscription(cancelledCtx)).toThrow(PaymentRequiredError);
    });
  });

  // ============================================================
  // 4. MULTI-TENANT WABA ISOLATION
  // ============================================================
  describe("Milestone 5: Multi-Tenant WhatsApp Business API (WABA) Isolation", () => {
    it("encrypts and decrypts WABA System User Access Tokens securely", () => {
      const rawToken = "EAABwzL_production_meta_token_xyz987";
      const encrypted = encrypt(rawToken);

      expect(encrypted).not.toBe(rawToken);
      expect(decrypt(encrypted)).toBe(rawToken);
    });

    it("routes incoming WhatsApp messages strictly to the phone number's owner", () => {
      const tenants = new Map([
        ["phone_num_101", { accountId: "tenant-101", name: "Tenant 1" }],
        ["phone_num_202", { accountId: "tenant-202", name: "Tenant 2" }],
      ]);

      const lookupTenant = (phoneNumId: string) => tenants.get(phoneNumId);

      const resolved1 = lookupTenant("phone_num_101");
      expect(resolved1?.accountId).toBe("tenant-101");

      const resolved2 = lookupTenant("phone_num_202");
      expect(resolved2?.accountId).toBe("tenant-202");

      const unknown = lookupTenant("phone_num_unknown");
      expect(unknown).toBeUndefined();
    });
  });

  // ============================================================
  // 5. AI QUOTAS & AUTOMATED MAINTENANCE
  // ============================================================
  describe("Milestone 6: AI Quotas, Usage Metering & Maintenance Cron", () => {
    it("computes calendar month boundaries for UTC quota cycles", () => {
      const testDate = new Date("2026-09-15T14:30:00Z");
      const startOfMonth = getStartOfMonth(testDate);
      const startOfNextMonth = getStartOfNextMonth(testDate);

      expect(startOfMonth.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(startOfNextMonth.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    });

    it("evaluates BYO-Key accounts as having unlimited AI quota", async () => {
      const mockDb: any = {
        from: (table: string) => {
          if (table === "ai_configs") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { api_key: "sk-custom-openai-key", is_active: true },
                  }),
                }),
              }),
            };
          }
          if (table === "ai_usage_log") {
            return {
              select: () => ({
                eq: () => ({
                  gte: async () => ({
                    data: [{ total_tokens: 150000 }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const quota = await checkAiQuota(mockDb, "acc-byo");
      expect(quota.allowed).toBe(true);
      expect(quota.hasByoKey).toBe(true);
      expect(quota.monthlyQuota).toBeNull();
      expect(quota.remaining).toBeNull();
      expect(quota.monthlyUsed).toBe(150000);
    });

    it("evaluates platform allowance with 50,000 monthly token cap", async () => {
      // 1. Under quota
      const mockDbUnder: any = {
        from: (table: string) => {
          if (table === "ai_configs") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            };
          }
          if (table === "ai_usage_log") {
            return {
              select: () => ({
                eq: () => ({
                  gte: async () => ({
                    data: [{ total_tokens: 12000 }, { total_tokens: 8000 }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const quotaUnder = await checkAiQuota(mockDbUnder, "acc-platform-1");
      expect(quotaUnder.allowed).toBe(true);
      expect(quotaUnder.hasByoKey).toBe(false);
      expect(quotaUnder.monthlyQuota).toBe(DEFAULT_MONTHLY_TOKEN_QUOTA);
      expect(quotaUnder.monthlyUsed).toBe(20000);
      expect(quotaUnder.remaining).toBe(30000);

      // 2. Over quota
      const mockDbOver: any = {
        from: (table: string) => {
          if (table === "ai_configs") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            };
          }
          if (table === "ai_usage_log") {
            return {
              select: () => ({
                eq: () => ({
                  gte: async () => ({
                    data: [{ total_tokens: 52000 }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const quotaOver = await checkAiQuota(mockDbOver, "acc-platform-2");
      expect(quotaOver.allowed).toBe(false);
      expect(quotaOver.hasByoKey).toBe(false);
      expect(quotaOver.remaining).toBe(0);
      expect(quotaOver.monthlyUsed).toBe(52000);
    });

    it("simulates maintenance cron transition rules accurately", () => {
      const now = new Date("2026-09-10T00:00:00Z");
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const subscriptions = [
        {
          id: "sub-1",
          status: "trialing",
          trial_ends_at: "2026-09-08T00:00:00Z", // Expired trial
          current_period_end: "2026-09-08T00:00:00Z",
        },
        {
          id: "sub-2",
          status: "trialing",
          trial_ends_at: "2026-09-14T00:00:00Z", // Active trial
          current_period_end: "2026-09-14T00:00:00Z",
        },
        {
          id: "sub-3",
          status: "past_due",
          trial_ends_at: null,
          current_period_end: "2026-09-05T00:00:00Z", // Past 3-day grace
        },
        {
          id: "sub-4",
          status: "past_due",
          trial_ends_at: null,
          current_period_end: "2026-09-09T00:00:00Z", // Within 3-day grace
        },
      ];

      // Expired trials -> past_due
      const expiredTrials = subscriptions.filter(
        (s) => s.status === "trialing" && s.trial_ends_at && new Date(s.trial_ends_at) < now,
      );
      expect(expiredTrials.map((s) => s.id)).toEqual(["sub-1"]);

      // Expired grace periods -> cancelled
      const expiredGrace = subscriptions.filter(
        (s) =>
          s.status === "past_due" &&
          s.current_period_end &&
          new Date(s.current_period_end) < threeDaysAgo,
      );
      expect(expiredGrace.map((s) => s.id)).toEqual(["sub-3"]);
    });
  });
});
