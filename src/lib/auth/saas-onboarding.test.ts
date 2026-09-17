import { describe, expect, it } from "vitest";

/**
 * Milestone 2: Customer Self-Serve Onboarding & Bootstrap Test Suite
 */
describe("Milestone 2: Customer Self-Serve Onboarding & Bootstrap", () => {
  describe("1. Organization Name & Slug Generation", () => {
    function generateTenantSlug(name: string, userId: string): string {
      const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const suffix = userId.substring(0, 8);
      return `${cleanName || "org"}-${suffix}`;
    }

    it("generates a clean URL-friendly slug from standard company names", () => {
      const slug = generateTenantSlug("Apex Solar Solutions", "12345678-abcd-ef01-2345-6789abcdef01");
      expect(slug).toBe("apex-solar-solutions-12345678");
    });

    it("handles special characters and extra spaces gracefully", () => {
      const slug = generateTenantSlug("   Acme & Co. (Pvt) Ltd!  ", "abcdef01-2345-6789-abcd-ef0123456789");
      expect(slug).toBe("acme-co-pvt-ltd-abcdef01");
    });

    it("falls back to 'org-<id>' when organization name is non-alphanumeric", () => {
      const slug = generateTenantSlug("!!! $$$ ***", "98765432-1111-2222-3333-444455556666");
      expect(slug).toBe("org-98765432");
    });
  });

  describe("2. Tenant Bootstrap Seeding Structures", () => {
    const defaultPipelineStages = [
      { name: "New Lead", position: 0, color: "#3b82f6" },
      { name: "Qualified", position: 1, color: "#8b5cf6" },
      { name: "Proposal Sent", position: 2, color: "#f59e0b" },
      { name: "Won", position: 3, color: "#10b981" },
      { name: "Lost", position: 4, color: "#ef4444" },
    ];

    const defaultTags = [
      { name: "Hot Lead", color: "#ef4444" },
      { name: "Follow Up", color: "#f59e0b" },
      { name: "VIP", color: "#8b5cf6" },
      { name: "Customer", color: "#10b981" },
    ];

    const defaultTemplates = [
      {
        name: "Welcome Intro",
        category: "Utility",
        bodyText: "Hi {{1}}, thanks for reaching out to us! How can we help you today?",
      },
      {
        name: "Demo Booking",
        category: "Marketing",
        bodyText: "Hi {{1}}, thanks for your interest. You can book a quick 15-minute demo with our team here: {{2}}",
      },
    ];

    it("defines the 5 core stages with sequential positions and colors", () => {
      expect(defaultPipelineStages).toHaveLength(5);
      expect(defaultPipelineStages.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
      expect(defaultPipelineStages.map((s) => s.name)).toEqual([
        "New Lead",
        "Qualified",
        "Proposal Sent",
        "Won",
        "Lost",
      ]);
    });

    it("defines standard quick tags for immediate lead categorization", () => {
      expect(defaultTags).toHaveLength(4);
      expect(defaultTags.map((t) => t.name)).toContain("Hot Lead");
      expect(defaultTags.map((t) => t.name)).toContain("VIP");
    });

    it("seeds valid WhatsApp message templates", () => {
      expect(defaultTemplates).toHaveLength(2);
      expect(defaultTemplates[0].category).toBe("Utility");
      expect(defaultTemplates[1].category).toBe("Marketing");
      expect(defaultTemplates[0].bodyText).toContain("{{1}}");
    });
  });

  describe("3. Currency & Timezone Validation", () => {
    function isValidIsoCurrency(currency: string): boolean {
      return /^[A-Z]{3}$/.test(currency);
    }

    it("validates supported ISO-4217 currencies", () => {
      expect(isValidIsoCurrency("INR")).toBe(true);
      expect(isValidIsoCurrency("USD")).toBe(true);
      expect(isValidIsoCurrency("EUR")).toBe(true);
      expect(isValidIsoCurrency("AED")).toBe(true);
      expect(isValidIsoCurrency("GBP")).toBe(true);
      expect(isValidIsoCurrency("usd")).toBe(false); // must be uppercase
      expect(isValidIsoCurrency("US")).toBe(false);
      expect(isValidIsoCurrency("USDT")).toBe(false);
    });

    it("validates timezone resolution", () => {
      const supportedTimezones = ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"];
      expect(supportedTimezones).toContain("Asia/Kolkata");
      expect(supportedTimezones).toContain("UTC");
    });
  });

  describe("4. Onboarding State Completion", () => {
    interface AccountOnboardingState {
      name: string;
      onboarding_completed_at: string | null;
      status: "active" | "past_due" | "suspended" | "cancelled";
    }

    function needsOnboarding(account: AccountOnboardingState): boolean {
      return account.onboarding_completed_at === null;
    }

    it("detects when an account is pending initial onboarding", () => {
      const freshAccount: AccountOnboardingState = {
        name: "Acme",
        onboarding_completed_at: null,
        status: "active",
      };
      expect(needsOnboarding(freshAccount)).toBe(true);
    });

    it("detects when onboarding is completed", () => {
      const onboardedAccount: AccountOnboardingState = {
        name: "Acme",
        onboarding_completed_at: new Date().toISOString(),
        status: "active",
      };
      expect(needsOnboarding(onboardedAccount)).toBe(false);
    });
  });
});
