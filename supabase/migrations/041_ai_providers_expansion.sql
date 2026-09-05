-- ============================================================
-- Migration: 041_ai_providers_expansion
-- Description: Expands the ai_configs provider check constraint
-- to allow 'openrouter' and 'custom'. Adds a base_url column
-- for custom OpenAI-compatible providers.
-- ============================================================

-- 1. Drop the existing provider constraint
ALTER TABLE ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

-- 2. Add the new constraint with expanded options
ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check 
  CHECK (provider IN ('openai', 'anthropic', 'openrouter', 'custom'));

-- 3. Add base_url for the 'custom' provider
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS base_url text;
