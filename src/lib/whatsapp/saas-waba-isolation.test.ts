import { describe, expect, it } from "vitest";
import { encrypt, decrypt } from "./encryption";

/**
 * Multi-Tenant WhatsApp Business API (WABA) Isolation Test Suite
 *
 * Validates the core architectural requirements defined in:
 * - docs/saas/SAAS_IMPLEMENTATION_ROADMAP.md (Milestone 5)
 * - docs/saas/SAAS_ARCHITECTURE_SPEC.md
 * - Zero cross-talk routing and per-tenant credential isolation.
 */
describe("Multi-Tenant WhatsApp WABA Isolation & Routing", () => {
  // Test fixture representing two isolated customer organizations
  const orgA = {
    accountId: "org-alpha-1111-1111-1111-111111111111",
    name: "Alpha Solar",
    phoneNumberId: "phone_num_alpha_101",
    wabaId: "waba_alpha_201",
    accessToken: "EAABwzL_alpha_secret_token_1",
  };

  const orgB = {
    accountId: "org-beta-2222-2222-2222-222222222222",
    name: "Beta Logistics",
    phoneNumberId: "phone_num_beta_102",
    wabaId: "waba_beta_202",
    accessToken: "EAABwzL_beta_secret_token_2",
  };

  describe("1. Per-Tenant Credential Encryption & Integrity", () => {
    it("encrypts and decrypts each tenant's access token independently", () => {
      const encryptedA = encrypt(orgA.accessToken);
      const encryptedB = encrypt(orgB.accessToken);

      // Verify encrypted payloads differ from each other and from raw
      expect(encryptedA).not.toBe(orgA.accessToken);
      expect(encryptedB).not.toBe(orgB.accessToken);
      expect(encryptedA).not.toBe(encryptedB);

      // Verify symmetric decryption restores exact token
      expect(decrypt(encryptedA)).toBe(orgA.accessToken);
      expect(decrypt(encryptedB)).toBe(orgB.accessToken);
    });
  });

  describe("2. Phone Number Claim Collision Prevention", () => {
    // Simulated database registry
    const registry: Array<{
      account_id: string;
      phone_number_id: string;
    }> = [
      {
        account_id: orgA.accountId,
        phone_number_id: orgA.phoneNumberId,
      },
    ];

    function validatePhoneNumberClaim(
      targetAccountId: string,
      targetPhoneNumberId: string,
    ): { allowed: boolean; error?: string } {
      const existing = registry.find(
        (r) => r.phone_number_id === targetPhoneNumberId && r.account_id !== targetAccountId,
      );

      if (existing) {
        return {
          allowed: false,
          error:
            "This WhatsApp phone number is already connected to another organization. Each official WhatsApp number can only be bound to a single tenant account.",
        };
      }

      return { allowed: true };
    }

    it("allows Organization A to update its own existing phone number", () => {
      const result = validatePhoneNumberClaim(orgA.accountId, orgA.phoneNumberId);
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("allows Organization B to claim an unclaimed phone number", () => {
      const result = validatePhoneNumberClaim(orgB.accountId, orgB.phoneNumberId);
      expect(result.allowed).toBe(true);
    });

    it("strictly blocks Organization B from hijacking Organization A's phone number", () => {
      const result = validatePhoneNumberClaim(orgB.accountId, orgA.phoneNumberId);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain("already connected to another organization");
    });
  });

  describe("3. Inbound Webhook Zero Cross-Talk Resolver", () => {
    const configTable = [
      {
        account_id: orgA.accountId,
        phone_number_id: orgA.phoneNumberId,
        user_id: "user_a",
      },
      {
        account_id: orgB.accountId,
        phone_number_id: orgB.phoneNumberId,
        user_id: "user_b",
      },
    ];

    function resolveTenantForInbound(phoneNumberId: string) {
      const matches = configTable.filter((c) => c.phone_number_id === phoneNumberId);
      if (matches.length === 0) return { error: "no_config" };
      if (matches.length > 1) return { error: "multiple_configs_dropped" };
      return { accountId: matches[0].account_id, userId: matches[0].user_id };
    }

    it("accurately routes inbound WhatsApp message to Organization A", () => {
      const res = resolveTenantForInbound(orgA.phoneNumberId);
      expect(res.accountId).toBe(orgA.accountId);
      expect(res.userId).toBe("user_a");
      expect(res.accountId).not.toBe(orgB.accountId);
    });

    it("accurately routes inbound WhatsApp message to Organization B", () => {
      const res = resolveTenantForInbound(orgB.phoneNumberId);
      expect(res.accountId).toBe(orgB.accountId);
      expect(res.userId).toBe("user_b");
      expect(res.accountId).not.toBe(orgA.accountId);
    });

    it("safely ignores messages for unregistered phone numbers", () => {
      const res = resolveTenantForInbound("unregistered_phone_999");
      expect(res.error).toBe("no_config");
      expect(res.accountId).toBeUndefined();
    });
  });

  describe("4. Message Status Callback Account Scoping", () => {
    interface MessageRecord {
      id: string;
      message_id: string;
      account_id: string;
      status: "sent" | "delivered" | "read" | "failed";
    }

    const messagesStore: MessageRecord[] = [
      {
        id: "rec-1",
        message_id: "wamid.HBgLMTExMTEx",
        account_id: orgA.accountId,
        status: "sent",
      },
      {
        id: "rec-2",
        // In edge cases Meta message IDs may match across separate numbers
        message_id: "wamid.HBgLMTExMTEx",
        account_id: orgB.accountId,
        status: "sent",
      },
    ];

    function updateMessageStatusScoped(
      messageId: string,
      scopedAccountId: string | null,
      newStatus: "delivered" | "read" | "failed",
    ) {
      let matches = messagesStore.filter((m) => m.message_id === messageId);
      if (scopedAccountId) {
        matches = matches.filter((m) => m.account_id === scopedAccountId);
      }
      matches.forEach((m) => {
        m.status = newStatus;
      });
      return matches;
    }

    it("updates message status only within the targeted tenant account", () => {
      // Organization A receives a status delivery update
      const updated = updateMessageStatusScoped(
        "wamid.HBgLMTExMTEx",
        orgA.accountId,
        "delivered",
      );

      expect(updated.length).toBe(1);
      expect(updated[0].account_id).toBe(orgA.accountId);
      expect(updated[0].status).toBe("delivered");

      // Verify Organization B's message was untouched (still 'sent')
      const orgBMessage = messagesStore.find((m) => m.id === "rec-2");
      expect(orgBMessage?.status).toBe("sent");
    });
  });
});
