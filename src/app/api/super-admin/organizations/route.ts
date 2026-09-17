import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, toErrorResponse } from "@/lib/auth/account";

/**
 * GET /api/super-admin/organizations
 *
 * Lists customer organizations with optional search, status filtering, and owner profile metadata.
 * Guarded strictly by requireSuperAdmin().
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    let query = ctx.supabase
      .from("accounts")
      .select(
        "id, name, slug, status, plan_tier, default_currency, timezone, owner_user_id, created_at, onboarding_completed_at",
        { count: "exact" },
      );

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: accounts, count, error } = await query;

    if (error) {
      console.error("[super-admin/organizations] query error:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    // Hydrate owner email and full name
    const ownerIds = Array.from(new Set((accounts || []).map((a) => a.owner_user_id).filter(Boolean)));
    const ownerMap: Record<string, { email: string; fullName: string }> = {};

    if (ownerIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", ownerIds);

      (profiles || []).forEach((p) => {
        ownerMap[p.user_id] = {
          email: p.email,
          fullName: p.full_name,
        };
      });
    }

    // Count members per account
    const accountIds = (accounts || []).map((a) => a.id);
    const memberCountMap: Record<string, number> = {};

    if (accountIds.length > 0) {
      const { data: members } = await ctx.supabase
        .from("account_members")
        .select("account_id");

      (members || []).forEach((m) => {
        memberCountMap[m.account_id] = (memberCountMap[m.account_id] || 0) + 1;
      });
    }

    const organizations = (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      status: a.status,
      planTier: a.plan_tier,
      defaultCurrency: a.default_currency,
      timezone: a.timezone,
      createdAt: a.created_at,
      onboardingCompleted: !!a.onboarding_completed_at,
      owner: ownerMap[a.owner_user_id] || {
        email: "unknown",
        fullName: "Unknown Owner",
      },
      memberCount: memberCountMap[a.id] || 1,
    }));

    return NextResponse.json({
      organizations,
      total: count || 0,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
