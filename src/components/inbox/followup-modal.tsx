"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Conversation } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPresetFollowUpTimes } from "@/lib/inbox/followup-utils";

interface FollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  onSaved: (updatedConversation: Conversation) => void;
}

export function FollowUpModal({
  open,
  onOpenChange,
  conversation,
  onSaved,
}: FollowUpModalProps) {
  const supabase = createClient();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !conversation) return;
    if (conversation.follow_up_at) {
      // ISO string slice for datetime-local input (YYYY-MM-DDTHH:mm)
      const d = new Date(conversation.follow_up_at);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localIso = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      setSelectedDate(localIso);
    } else {
      setSelectedDate("");
    }
    setNote(conversation.follow_up_note || "");
  }, [open, conversation]);

  if (!conversation) return null;

  async function handleSave(dateToSave?: Date) {
    if (!conversation) return;
    let targetIso: string | null = null;
    if (dateToSave) {
      targetIso = dateToSave.toISOString();
    } else if (selectedDate) {
      targetIso = new Date(selectedDate).toISOString();
    }

    if (!targetIso) {
      toast.error("Please select a follow-up date and time.");
      return;
    }

    setSaving(true);
    try {
      const updates = {
        follow_up_at: targetIso,
        follow_up_note: note.trim() || null,
        follow_up_set_by_user_id: user?.id || null,
        follow_up_completed_at: null,
      };

      const { data, error } = await supabase
        .from("conversations")
        .update(updates)
        .eq("id", conversation.id)
        .select("*, contact:contacts(*, contact_tags(tags(*)))")
        .single();

      if (error) throw error;

      toast.success("Follow-up scheduled!");
      onSaved(data as Conversation);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to set follow-up";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!conversation) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .update({
          follow_up_completed_at: new Date().toISOString(),
        })
        .eq("id", conversation.id)
        .select("*, contact:contacts(*, contact_tags(tags(*)))")
        .single();

      if (error) throw error;

      toast.success("Follow-up marked as completed!");
      onSaved(data as Conversation);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete follow-up";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!conversation) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .update({
          follow_up_at: null,
          follow_up_note: null,
          follow_up_set_by_user_id: null,
          follow_up_completed_at: null,
        })
        .eq("id", conversation.id)
        .select("*, contact:contacts(*, contact_tags(tags(*)))")
        .single();

      if (error) throw error;

      toast.success("Follow-up cleared.");
      onSaved(data as Conversation);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to clear follow-up";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const presets = getPresetFollowUpTimes();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-lg font-bold">
            <Clock className="h-5 w-5 text-primary" />
            Schedule Follow-up
          </DialogTitle>
          <DialogDescription>
            Schedule a follow-up reminder for {conversation.contact?.name || conversation.contact?.phone || "this conversation"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Presets */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Presets
            </Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleSave(p.date)}
                  className="h-auto flex-col py-2.5 px-2 text-xs font-heading font-semibold hover:border-primary/50 hover:bg-primary/10"
                >
                  <Calendar className="mb-1 h-4 w-4 text-primary" />
                  <span>{p.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="custom-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Custom Date & Time
            </Label>
            <Input
              id="custom-date"
              type="datetime-local"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-card/50 border-border text-foreground"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="followup-note" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Next Action / Note (Optional)
            </Label>
            <Textarea
              id="followup-note"
              placeholder="e.g. Call back regarding pricing proposal..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="bg-card/50 border-border text-foreground resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {conversation.follow_up_at && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={handleClear}
                  className="text-muted-foreground hover:text-destructive hover:border-destructive/40"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
                {!conversation.follow_up_completed_at && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={handleComplete}
                    className="text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Complete
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => handleSave()}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save Follow-up
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
