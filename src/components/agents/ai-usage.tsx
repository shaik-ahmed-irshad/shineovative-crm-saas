'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, BarChart3, Bot, KeyRound, PencilLine, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Badge } from '@/components/ui/badge';
import type { AiQuotaStatus } from '@/lib/ai/quota';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/dashboard/skeleton';
import { BarChart } from '@/components/tremor/bar-chart';
import { formatCompactNumber } from '@/lib/currency';
import { format, parseISO } from 'date-fns';

interface UsageResponse {
  window_days: number;
  truncated: boolean;
  totals: {
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  by_mode: {
    auto_reply: { calls: number; tokens: number };
    draft: { calls: number; tokens: number };
  };
  by_model: {
    model: string;
    provider: string;
    calls: number;
    tokens: number;
  }[];
  daily: { date: string; tokens: number; calls: number }[];
}

const WINDOWS = [7, 30, 90] as const;

/**
 * Token-spend dashboard for the account's BYO key. Admin-only (spend is
 * billing-class), mirroring the `ai_usage_log` SELECT policy and the
 * `GET /api/ai/usage` route. Renders nothing for non-admins.
 */
export function AiUsageCard() {
  const { accountId, accountRole, profileLoading } = useAuth();
  const canView = accountRole ? canEditSettings(accountRole) : false;

  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [quotaData, setQuotaData] = useState<AiQuotaStatus | null>(null);
  const loadedRef = useRef<string | null>(null);

  const fetchUsage = useCallback(async (windowDays: number) => {
    setLoading(true);
    try {
      const [res, quotaRes] = await Promise.all([
        fetch(`/api/ai/usage?days=${windowDays}`, { cache: 'no-store' }),
        fetch('/api/ai/quota', { cache: 'no-store' }),
      ]);

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed to load usage');
        setData(null);
      } else {
        setData(json as UsageResponse);
      }

      if (quotaRes.ok) {
        const qJson = await quotaRes.json().catch(() => null);
        if (qJson?.quota) {
          setQuotaData(qJson.quota as AiQuotaStatus);
        }
      }
    } catch {
      toast.error('Failed to load usage');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView || !accountId) return;
    // Refetch on account switch or window change.
    const key = `${accountId}:${days}`;
    if (loadedRef.current === key) return;
    loadedRef.current = key;
    void fetchUsage(days);
  }, [canView, accountId, days, fetchUsage]);

  if (profileLoading || !canView) return null;

  const chartData =
    data?.daily.map((d) => ({ day: format(parseISO(d.date), 'MMM d'), Tokens: d.tokens })) ??
    [];
  const hasSpend = (data?.totals.total_tokens ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Token usage
            </CardTitle>
            <CardDescription>
              Tokens spent on your provider key by drafts and the auto-reply
              bot. Counts only — no message content is stored here.
            </CardDescription>
          </div>
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger className="w-32 flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Last {w} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {quotaData && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {quotaData.hasByoKey ? (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    <KeyRound className="h-3 w-3" /> BYO Key Active — Unlimited
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3 text-primary" /> Monthly Complimentary Allowance
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Resets {format(parseISO(quotaData.resetsAt), 'MMM d, yyyy')}
              </span>
            </div>

            {quotaData.hasByoKey ? (
              <p className="text-xs text-muted-foreground">
                Your custom provider API key is active. Token consumption is billed directly by your LLM provider with unlimited platform throughput.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    {formatCompactNumber(quotaData.monthlyUsed)} of {formatCompactNumber(quotaData.monthlyQuota || 50000)} tokens used this month
                  </span>
                  <span className={quotaData.allowed ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
                    {formatCompactNumber(quotaData.remaining ?? 0)} tokens remaining
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      (quotaData.remaining ?? 0) <= 0
                        ? "bg-destructive"
                        : (quotaData.remaining ?? 0) < 10000
                        ? "bg-amber-500"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((quotaData.monthlyUsed / (quotaData.monthlyQuota || 50000)) * 100))}%`,
                    }}
                  />
                </div>
                {!quotaData.allowed && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Monthly allowance exhausted. Configure a custom API key in the Agent Settings tab to continue automated responses.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loading || !data ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !hasSpend ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <BarChart3 className="h-8 w-8 opacity-40" />
            <p>No AI usage in the last {data.window_days} days yet.</p>
            <p className="text-xs">
              This fills in as the assistant drafts and auto-replies.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total tokens" value={formatCompactNumber(data.totals.total_tokens)} />
              <Stat label="LLM calls" value={String(data.totals.calls)} />
              <Stat
                label="Auto-reply"
                value={formatCompactNumber(data.by_mode.auto_reply.tokens)}
                icon={Bot}
              />
              <Stat
                label="Drafts"
                value={formatCompactNumber(data.by_mode.draft.tokens)}
                icon={PencilLine}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Tokens per day
              </p>
              <BarChart
                data={chartData}
                index="day"
                categories={['Tokens']}
                colors={['violet']}
                valueFormatter={(v) => formatCompactNumber(v)}
                showLegend={false}
                yAxisWidth={48}
                className="h-[200px]"
              />
            </div>

            {data.by_model.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  By model
                </p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.by_model.map((m) => (
                    <li
                      key={`${m.provider}:${m.model}`}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-foreground">{m.model}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          ({m.provider})
                        </span>
                      </span>
                      <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                        {formatCompactNumber(m.tokens)} tok · {m.calls}{' '}
                        {m.calls === 1 ? 'call' : 'calls'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.truncated && (
              <p className="text-xs text-muted-foreground">
                Showing a partial window — usage is high enough that only the
                most recent records are summarized here.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Bot;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
