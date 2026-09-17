import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let _adminClient: any = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _adminClient;
}

/**
 * Executes scheduled platform maintenance:
 * 1. Expired Trials Transition: 'trialing' -> 'past_due' once trial_ends_at has passed.
 * 2. Grace Period Expiration: 'past_due' -> 'cancelled' 3 days after current_period_end.
 * 3. Writes summary event to saas_audit_logs.
 */
async function runMaintenance(req: NextRequest) {
  // Verify authorization secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : xCronSecret?.trim();

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // 1. Find and transition expired trials
  const { data: expiredTrials, error: trialFetchErr } = await db
    .from("subscriptions")
    .select("id, account_id")
    .eq("status", "trialing")
    .lt("trial_ends_at", now.toISOString());

  if (trialFetchErr) {
    console.error("[cron/maintenance] Error querying expired trials:", trialFetchErr);
  }

  const expiredTrialAccountIds = (expiredTrials || []).map(
    (t: { account_id: string }) => t.account_id,
  );

  if (expiredTrialAccountIds.length > 0) {
    await db
      .from("subscriptions")
      .update({ status: "past_due", updated_at: now.toISOString() })
      .in("account_id", expiredTrialAccountIds)
      .eq("status", "trialing");

    await db
      .from("accounts")
      .update({ status: "past_due", updated_at: now.toISOString() })
      .in("id", expiredTrialAccountIds)
      .neq("status", "suspended");
  }

  // 2. Find and transition expired past_due subscriptions (beyond 3-day grace period)
  const { data: expiredGrace, error: graceFetchErr } = await db
    .from("subscriptions")
    .select("id, account_id")
    .eq("status", "past_due")
    .lt("current_period_end", threeDaysAgo.toISOString());

  if (graceFetchErr) {
    console.error("[cron/maintenance] Error querying expired grace periods:", graceFetchErr);
  }

  const expiredGraceAccountIds = (expiredGrace || []).map(
    (g: { account_id: string }) => g.account_id,
  );

  if (expiredGraceAccountIds.length > 0) {
    await db
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .in("account_id", expiredGraceAccountIds)
      .eq("status", "past_due");

    await db
      .from("accounts")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .in("id", expiredGraceAccountIds)
      .neq("status", "suspended");
  }

  // 3. Security & Operations Audit Log
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "cron-scheduler";
  await db.from("saas_audit_logs").insert({
    actor_email: "system-cron@platform.internal",
    action: "cron.maintenance_executed",
    target_account_id: null,
    details: {
      expired_trials_count: expiredTrialAccountIds.length,
      past_due_cancelled_count: expiredGraceAccountIds.length,
      timestamp: now.toISOString(),
    },
    ip_address: ipAddress,
  });

  return NextResponse.json({
    ok: true,
    expired_trials_updated: expiredTrialAccountIds.length,
    past_due_cancelled: expiredGraceAccountIds.length,
    timestamp: now.toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return runMaintenance(req);
}

export async function POST(req: NextRequest) {
  return runMaintenance(req);
}
