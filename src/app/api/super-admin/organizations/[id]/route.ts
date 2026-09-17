import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";

/**
 * GET /api/super-admin/organizations/[id]
 *
 * Detailed inspection and diagnostics for a specific tenant organization.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireSuperAdmin();
    const { id } = await params;

    // 1. Account Details
    const { data: account, error: accountErr } = await ctx.supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (accountErr || !account) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 2. WhatsApp Configuration
    const { data: whatsappConfig } = await ctx.supabase
      .from("whatsapp_config")
      .select("phone_number_id, waba_id, status, registered_at, subscribed_apps_at, last_registration_error")
      .eq("account_id", id)
      .maybeSingle();

    // 3. Team Members
    const { data: members } = await ctx.supabase
      .from("account_members")
      .select("user_id, role, created_at")
      .eq("account_id", id);

    const memberUserIds = (members || []).map((m) => m.user_id);
    const profileMap: Record<string, { email: string; fullName: string; avatarUrl: string | null }> = {};

    if (memberUserIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("user_id, email, full_name, avatar_url")
        .in("user_id", memberUserIds);

      (profiles || []).forEach((p) => {
        profileMap[p.user_id] = {
          email: p.email,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
        };
      });
    }

    const team = (members || []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: m.created_at,
      email: profileMap[m.user_id]?.email || "unknown",
      fullName: profileMap[m.user_id]?.fullName || "Unknown Member",
      avatarUrl: profileMap[m.user_id]?.avatarUrl || null,
    }));

    // 4. Entity usage counters
    const [{ count: contactsCount }, { count: pipelinesCount }, { count: dealsCount }, { count: messagesCount }] =
      await Promise.all([
        ctx.supabase.from("contacts").select("*", { count: "exact", head: true }).eq("account_id", id),
        ctx.supabase.from("pipelines").select("*", { count: "exact", head: true }).eq("account_id", id),
        ctx.supabase.from("deals").select("*", { count: "exact", head: true }).eq("account_id", id),
        ctx.supabase.from("messages").select("*", { count: "exact", head: true }).eq("account_id", id),
      ]);

    // 5. Recent audit logs for this tenant
    const { data: auditLogs } = await ctx.supabase
      .from("saas_audit_logs")
      .select("*")
      .eq("target_account_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      organization: {
        id: account.id,
        name: account.name,
        slug: account.slug,
        status: account.status,
        planTier: account.plan_tier,
        defaultCurrency: account.default_currency,
        timezone: account.timezone,
        logoUrl: account.logo_url,
        createdAt: account.created_at,
        onboardingCompleted: !!account.onboarding_completed_at,
      },
      whatsapp: whatsappConfig || null,
      team,
      usage: {
        contacts: contactsCount || 0,
        pipelines: pipelinesCount || 0,
        deals: dealsCount || 0,
        messages: messagesCount || 0,
      },
      recentAuditLogs: auditLogs || [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PATCH /api/super-admin/organizations/[id]
 *
 * Administrative updates: Suspend, Reactivate, or modify organization configuration.
 * Writes immutable audit trail to saas_audit_logs.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireSuperAdmin();
    const { id } = await params;
    const body = await req.json();

    // Fetch current state
    const { data: current, error: fetchErr } = await ctx.supabase
      .from("accounts")
      .select("id, name, status, plan_tier")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    let auditAction = "tenant.update";
    const auditDetails: Record<string, unknown> = {
      target_name: current.name,
      previous_state: { ...current },
    };

    if (body.status && ["active", "suspended", "past_due", "cancelled"].includes(body.status)) {
      updates.status = body.status;
      if (body.status === "suspended") {
        auditAction = "tenant.suspend";
      } else if (body.status === "active" && current.status === "suspended") {
        auditAction = "tenant.reactivate";
      } else {
        auditAction = "tenant.status_change";
      }
      auditDetails.status_change = { from: current.status, to: body.status };
    }

    if (body.planTier && typeof body.planTier === "string") {
      updates.plan_tier = body.planTier;
      auditDetails.plan_change = { from: current.plan_tier, to: body.planTier };
    }

    if (body.name && typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
      auditDetails.name_change = { from: current.name, to: body.name.trim() };
    }

    if (body.reason && typeof body.reason === "string") {
      auditDetails.reason = body.reason;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error: updateErr } = await ctx.supabase
      .from("accounts")
      .update(updates)
      .eq("id", id);

    if (updateErr) {
      console.error("[super-admin] organization update error:", updateErr);
      return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
    }

    // Get actor email for audit record
    const { data: actorProfile } = await ctx.supabase
      .from("profiles")
      .select("email")
      .eq("user_id", ctx.userId)
      .single();

    const actorEmail = actorProfile?.email || "super_admin@shineovative.com";
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    // Write immutable audit log
    await ctx.supabase.from("saas_audit_logs").insert({
      actor_user_id: ctx.userId,
      actor_email: actorEmail,
      action: auditAction,
      target_account_id: id,
      details: auditDetails,
      ip_address: ipAddress,
    });

    return NextResponse.json({
      ok: true,
      action: auditAction,
      updated: updates,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
