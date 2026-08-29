-- ============================================================
-- 040_conversation_followups.sql — Follow-up & Snooze fields on Conversations
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS follow_up_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS follow_up_set_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for fast query performance in Follow-up Inbox filters
CREATE INDEX IF NOT EXISTS idx_conversations_follow_up
  ON conversations (account_id, follow_up_at)
  WHERE follow_up_at IS NOT NULL;
