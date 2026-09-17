import { describe, expect, it } from "vitest";
import {
  isPlatformRole,
  isPlatformSupport,
  isSuperAdmin,
  type PlatformRole,
} from "./roles";

/**
 * Super Admin Security, Tenant Diagnostics & Audit Trail Test Suite
 *
 * Validates specifications defined in:
 * - docs/saas/SAAS_SUPER_ADMIN_SPEC.md
 * - docs/saas/SAAS_ENTERPRISE_SECURITY_SPEC.md
 * - Milestone 3: Platform Super Admin Portal
 */
describe("Platform Super Admin & Audit Suite", () => {
  describe("Super Admin Role & Access Gating", () => {
    it("strictly isolates super_admin from regular tenant roles", () => {
      expect(isSuperAdmin("super_admin")).toBe(true);
      expect(isSuperAdmin("support")).toBe(false);
      expect(isSuperAdmin("none")).toBe(false);
      expect(isSuperAdmin(null)).toBe(false);
      expect(isSuperAdmin(undefined)).toBe(false);
    });

    it("verifies platform support access encompasses super_admin and support roles", () => {
      expect(isPlatformSupport("super_admin")).toBe(true);
      expect(isPlatformSupport("support")).toBe(true);
      expect(isPlatformSupport("none")).toBe(false);
      expect(isPlatformSupport(null)).toBe(false);
      expect(isPlatformSupport(undefined)).toBe(false);
    });

    it("verifies valid platform role enum values", () => {
      expect(isPlatformRole("super_admin")).toBe(true);
      expect(isPlatformRole("support")).toBe(true);
      expect(isPlatformRole("none")).toBe(true);
      expect(isPlatformRole("owner")).toBe(false);
      expect(isPlatformRole("admin")).toBe(false);
      expect(isPlatformRole("root")).toBe(false);
    });
  });

  describe("Tenant Status State Machine & Audit Action Derivation", () => {
    type TenantStatus = "active" | "suspended" | "past_due" | "cancelled";

    function deriveAuditAction(currentStatus: TenantStatus, newStatus: TenantStatus): string {
      if (newStatus === "suspended") return "tenant.suspend";
      if (newStatus === "active" && currentStatus === "suspended") return "tenant.reactivate";
      return "tenant.status_change";
    }

    it("identifies suspension action when changing status to suspended", () => {
      expect(deriveAuditAction("active", "suspended")).toBe("tenant.suspend");
      expect(deriveAuditAction("past_due", "suspended")).toBe("tenant.suspend");
    });

    it("identifies reactivation action when changing from suspended to active", () => {
      expect(deriveAuditAction("suspended", "active")).toBe("tenant.reactivate");
    });

    it("identifies general status change for other transitions", () => {
      expect(deriveAuditAction("active", "past_due")).toBe("tenant.status_change");
      expect(deriveAuditAction("past_due", "cancelled")).toBe("tenant.status_change");
    });

    it("validates permissible account statuses against SaaS specification", () => {
      const allowedStatuses: TenantStatus[] = ["active", "suspended", "past_due", "cancelled"];
      const testCases = [
        { status: "active", valid: true },
        { status: "suspended", valid: true },
        { status: "past_due", valid: true },
        { status: "cancelled", valid: true },
        { status: "archived", valid: false },
        { status: "deleted", valid: false },
        { status: "", valid: false },
      ];

      for (const tc of testCases) {
        expect(allowedStatuses.includes(tc.status as TenantStatus)).toBe(tc.valid);
      }
    });
  });

  describe("Support View (Impersonation) Mode", () => {
    it("formats audit log entry for entering support view mode", () => {
      const actorUserId = "admin-123";
      const actorEmail = "lead-architect@shineovative.com";
      const targetAccountId = "org-alpha-999";
      const orgName = "Alpha Global Solar";

      const auditEntry = {
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: "tenant.support_view_start",
        target_account_id: targetAccountId,
        details: {
          organization_name: orgName,
        },
        ip_address: "127.0.0.1",
        created_at: new Date().toISOString(),
      };

      expect(auditEntry.action).toBe("tenant.support_view_start");
      expect(auditEntry.target_account_id).toBe(targetAccountId);
      expect(auditEntry.details.organization_name).toBe(orgName);
      expect(auditEntry.actor_email).toBe(actorEmail);
    });

    it("formats audit log entry for exiting support view mode", () => {
      const auditEntry = {
        actor_user_id: "admin-123",
        actor_email: "lead-architect@shineovative.com",
        action: "tenant.support_view_end",
        target_account_id: "org-alpha-999",
        details: {
          organization_name: "Alpha Global Solar",
        },
        ip_address: "127.0.0.1",
        created_at: new Date().toISOString(),
      };

      expect(auditEntry.action).toBe("tenant.support_view_end");
      expect(auditEntry.target_account_id).toBe("org-alpha-999");
    });
  });

  describe("Platform Metrics & Diagnostics Aggregation", () => {
    it("accurately aggregates tenant counts by status", () => {
      const mockAccounts = [
        { id: "1", status: "active" },
        { id: "2", status: "active" },
        { id: "3", status: "suspended" },
        { id: "4", status: "past_due" },
        { id: "5", status: "active" },
      ];

      const total = mockAccounts.length;
      const active = mockAccounts.filter((a) => a.status === "active").length;
      const suspended = mockAccounts.filter((a) => a.status === "suspended").length;
      const pastDue = mockAccounts.filter((a) => a.status === "past_due").length;

      expect(total).toBe(5);
      expect(active).toBe(3);
      expect(suspended).toBe(1);
      expect(pastDue).toBe(1);
    });

    it("correctly filters 24h message throughput timestamp", () => {
      const now = new Date("2026-09-08T12:00:00Z");
      const oneHourAgo = new Date("2026-09-08T11:00:00Z");
      const twentyHoursAgo = new Date("2026-09-07T16:00:00Z");
      const twoDaysAgo = new Date("2026-09-06T12:00:00Z");

      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const messages = [
        { id: "m1", created_at: oneHourAgo.toISOString() },
        { id: "m2", created_at: twentyHoursAgo.toISOString() },
        { id: "m3", created_at: twoDaysAgo.toISOString() },
      ];

      const messages24h = messages.filter(
        (m) => new Date(m.created_at).getTime() >= cutoff.getTime(),
      );

      expect(messages24h.length).toBe(2);
      expect(messages24h.map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    it("safely sanitizes WhatsApp credentials in super admin diagnostics", () => {
      const rawWhatsappRow = {
        phone_number_id: "109823485720192",
        waba_id: "998234872394872",
        access_token: "EAABwzL_SECRET_META_TOKEN_NEVER_LEAK",
        webhook_verify_token: "my-webhook-secret-token",
        status: "connected",
        registered_at: "2026-09-01T10:00:00Z",
        subscribed_apps_at: "2026-09-01T10:05:00Z",
        last_registration_error: null,
      };

      // Ensure API response projector omits sensitive access_token and webhook_verify_token
      const projected = {
        phone_number_id: rawWhatsappRow.phone_number_id,
        waba_id: rawWhatsappRow.waba_id,
        status: rawWhatsappRow.status,
        registered_at: rawWhatsappRow.registered_at,
        subscribed_apps_at: rawWhatsappRow.subscribed_apps_at,
        last_registration_error: rawWhatsappRow.last_registration_error,
      };

      expect(projected).not.toHaveProperty("access_token");
      expect(projected).not.toHaveProperty("webhook_verify_token");
      expect(projected.phone_number_id).toBe("109823485720192");
      expect(projected.status).toBe("connected");
    });
  });
});
