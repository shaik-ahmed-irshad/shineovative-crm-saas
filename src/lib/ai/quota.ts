import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_MONTHLY_TOKEN_QUOTA = 50_000;

export interface AiQuotaStatus {
  allowed: boolean;
  hasByoKey: boolean;
  monthlyUsed: number;
  monthlyQuota: number | null; // null when unlimited (BYO-Key)
  remaining: number | null;
  resetsAt: string;
}

export class AiQuotaExceededError extends Error {
  readonly status = 429 as const;
  constructor(
    message = "Monthly complimentary AI token quota reached. Please provide your own OpenAI/OpenRouter API key in Settings to continue unlimited AI auto-replies.",
  ) {
    super(message);
    this.name = "AiQuotaExceededError";
  }
}

/**
 * Calculate beginning of current calendar month in UTC.
 */
export function getStartOfMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Calculate beginning of next calendar month in UTC (when quotas reset).
 */
export function getStartOfNextMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Evaluate whether an organization has available AI tokens.
 *
 * Rules:
 * 1. If the tenant has configured their own API Key (BYO-Key), AI access is unlimited.
 * 2. If using platform credits, tenants receive DEFAULT_MONTHLY_TOKEN_QUOTA (50,000 tokens/month).
 */
export async function checkAiQuota(
  db: SupabaseClient,
  accountId: string,
  quotaLimit = DEFAULT_MONTHLY_TOKEN_QUOTA,
): Promise<AiQuotaStatus> {
  const now = new Date();
  const startOfMonth = getStartOfMonth(now);
  const nextMonth = getStartOfNextMonth(now);

  // 1. Check if tenant has BYO-Key configured
  const { data: config } = await db
    .from("ai_configs")
    .select("api_key, is_active")
    .eq("account_id", accountId)
    .maybeSingle();

  const hasByoKey = Boolean(config?.api_key && config?.is_active);

  // 2. Fetch monthly token consumption from ai_usage_log
  const { data: usageRows, error } = await db
    .from("ai_usage_log")
    .select("total_tokens")
    .eq("account_id", accountId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    console.error("[checkAiQuota] error reading usage log:", error);
  }

  const monthlyUsed = (usageRows || []).reduce(
    (sum, row) => sum + (Number(row.total_tokens) || 0),
    0,
  );

  // If BYO-Key is active, usage is unlimited
  if (hasByoKey) {
    return {
      allowed: true,
      hasByoKey: true,
      monthlyUsed,
      monthlyQuota: null,
      remaining: null,
      resetsAt: nextMonth.toISOString(),
    };
  }

  // Evaluate platform allowance
  const remaining = Math.max(0, quotaLimit - monthlyUsed);
  const allowed = remaining > 0;

  return {
    allowed,
    hasByoKey: false,
    monthlyUsed,
    monthlyQuota: quotaLimit,
    remaining,
    resetsAt: nextMonth.toISOString(),
  };
}
