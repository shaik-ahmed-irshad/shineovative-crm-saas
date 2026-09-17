import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";

/**
 * GET /api/super-admin/audit-logs
 *
 * Query immutable platform administration audit records.
 * Guarded strictly by requireSuperAdmin().
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const { searchParams } = new URL(req.url);

    const targetAccountId = searchParams.get("target_account_id")?.trim();
    const action = searchParams.get("action")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    let query = ctx.supabase
      .from("saas_audit_logs")
      .select("*", { count: "exact" });

    if (targetAccountId) {
      query = query.eq("target_account_id", targetAccountId);
    }

    if (action) {
      query = query.eq("action", action);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: logs, count, error } = await query;

    if (error) {
      console.error("[super-admin/audit-logs] error:", error);
      return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/super-admin/audit-logs
 *
 * Appends an audit log entry (e.g., when Super Admin enters/exits View-As mode).
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const body = await req.json();

    if (!body.action || typeof body.action !== "string") {
      return NextResponse.json({ error: "Missing required action field" }, { status: 400 });
    }

    const { data: actorProfile } = await ctx.supabase
      .from("profiles")
      .select("email")
      .eq("user_id", ctx.userId)
      .single();

    const actorEmail = actorProfile?.email || "super_admin@shineovative.com";
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    const { data: log, error } = await ctx.supabase
      .from("saas_audit_logs")
      .insert({
        actor_user_id: ctx.userId,
        actor_email: actorEmail,
        action: body.action.trim(),
        target_account_id: body.targetAccountId || null,
        details: body.details || {},
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (error) {
      console.error("[super-admin/audit-logs] insert error:", error);
      return NextResponse.json({ error: "Failed to create audit log" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, log });
  } catch (err) {
    return toErrorResponse(err);
  }
}
