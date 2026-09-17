import { NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";

/**
 * GET /api/super-admin/stats
 *
 * Aggregates global SaaS platform metrics across all tenant organizations.
 * Guarded strictly by requireSuperAdmin().
 */
export async function GET() {
  try {
    const ctx = await requireSuperAdmin();

    // 1. Organization counts
    const { count: totalOrganizations } = await ctx.supabase
      .from("accounts")
      .select("*", { count: "exact", head: true });

    const { count: activeOrganizations } = await ctx.supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const { count: suspendedOrganizations } = await ctx.supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .eq("status", "suspended");

    // 2. Total CRM users across all tenants
    const { count: totalUsers } = await ctx.supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // 3. Message volume (Lifetime and Last 24 Hours)
    const { count: totalMessages } = await ctx.supabase
      .from("messages")
      .select("*", { count: "exact", head: true });

    const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: messagesLast24h } = await ctx.supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", past24Hours);

    // 4. WhatsApp WABA connection rate
    const { count: connectedWhatsApp } = await ctx.supabase
      .from("whatsapp_config")
      .select("*", { count: "exact", head: true })
      .eq("status", "connected");

    // 5. Recent registered accounts for dashboard summary
    const { data: recentOrganizations } = await ctx.supabase
      .from("accounts")
      .select("id, name, slug, status, plan_tier, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      metrics: {
        totalOrganizations: totalOrganizations || 0,
        activeOrganizations: activeOrganizations || 0,
        suspendedOrganizations: suspendedOrganizations || 0,
        totalUsers: totalUsers || 0,
        totalMessages: totalMessages || 0,
        messagesLast24h: messagesLast24h || 0,
        connectedWhatsApp: connectedWhatsApp || 0,
      },
      recentOrganizations: recentOrganizations || [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
