import { addDays, isBefore, isToday, isTomorrow, startOfDay, format } from "date-fns";
import type { Conversation } from "@/types";

export type FollowUpState = "none" | "overdue" | "due_today" | "scheduled" | "completed";

export function getFollowUpState(conversation: Conversation | null | undefined): FollowUpState {
  if (!conversation || !conversation.follow_up_at) {
    return "none";
  }
  if (conversation.follow_up_completed_at) {
    return "completed";
  }

  const followUpDate = new Date(conversation.follow_up_at);
  const now = new Date();

  if (isBefore(followUpDate, now) && !isToday(followUpDate)) {
    return "overdue";
  }

  if (isToday(followUpDate)) {
    return "due_today";
  }

  return "scheduled";
}

export function formatFollowUpLabel(followUpAtStr: string | null | undefined): string {
  if (!followUpAtStr) return "";
  const date = new Date(followUpAtStr);
  
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function getPresetFollowUpTimes(): { label: string; date: Date }[] {
  const now = new Date();
  
  // 1. Later today (3 hours from now or 5:00 PM)
  const laterToday = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  // 2. Tomorrow morning (9:00 AM)
  const tomorrow = startOfDay(addDays(now, 1));
  tomorrow.setHours(9, 0, 0, 0);

  // 3. Next Monday (9:00 AM)
  const daysUntilNextMon = (8 - now.getDay()) % 7 || 7;
  const nextMonday = startOfDay(addDays(now, daysUntilNextMon));
  nextMonday.setHours(9, 0, 0, 0);

  return [
    { label: "Later Today (+3h)", date: laterToday },
    { label: "Tomorrow (9:00 AM)", date: tomorrow },
    { label: "Next Week (Mon 9:00 AM)", date: nextMonday },
  ];
}
