import { describe, it, expect } from "vitest";
import {
  getFollowUpState,
  formatFollowUpLabel,
  getPresetFollowUpTimes,
} from "./followup-utils";
import type { Conversation } from "@/types";
import { addDays, subDays } from "date-fns";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    user_id: "u1",
    contact_id: "ct1",
    status: "open",
    unread_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("followup-utils", () => {
  describe("getFollowUpState", () => {
    it("returns 'none' when no follow_up_at is set", () => {
      const conv = makeConversation();
      expect(getFollowUpState(conv)).toBe("none");
    });

    it("returns 'completed' when follow_up_completed_at is set", () => {
      const conv = makeConversation({
        follow_up_at: new Date().toISOString(),
        follow_up_completed_at: new Date().toISOString(),
      });
      expect(getFollowUpState(conv)).toBe("completed");
    });

    it("returns 'overdue' for past dates that are not today", () => {
      const pastDate = subDays(new Date(), 2).toISOString();
      const conv = makeConversation({ follow_up_at: pastDate });
      expect(getFollowUpState(conv)).toBe("overdue");
    });

    it("returns 'due_today' for follow-ups scheduled today", () => {
      const todayDate = new Date().toISOString();
      const conv = makeConversation({ follow_up_at: todayDate });
      expect(getFollowUpState(conv)).toBe("due_today");
    });

    it("returns 'scheduled' for future dates beyond today", () => {
      const futureDate = addDays(new Date(), 3).toISOString();
      const conv = makeConversation({ follow_up_at: futureDate });
      expect(getFollowUpState(conv)).toBe("scheduled");
    });
  });

  describe("formatFollowUpLabel", () => {
    it("returns empty string for null or undefined input", () => {
      expect(formatFollowUpLabel(null)).toBe("");
      expect(formatFollowUpLabel(undefined)).toBe("");
    });

    it("formats today's follow-up with 'Today at ...'", () => {
      const today = new Date();
      const formatted = formatFollowUpLabel(today.toISOString());
      expect(formatted).toContain("Today at ");
    });

    it("formats tomorrow's follow-up with 'Tomorrow at ...'", () => {
      const tomorrow = addDays(new Date(), 1);
      const formatted = formatFollowUpLabel(tomorrow.toISOString());
      expect(formatted).toContain("Tomorrow at ");
    });
  });

  describe("getPresetFollowUpTimes", () => {
    it("returns 3 preset options: Later Today, Tomorrow, Next Week", () => {
      const presets = getPresetFollowUpTimes();
      expect(presets).toHaveLength(3);
      expect(presets[0].label).toContain("Later Today");
      expect(presets[1].label).toContain("Tomorrow");
      expect(presets[2].label).toContain("Next Week");
    });
  });
});
