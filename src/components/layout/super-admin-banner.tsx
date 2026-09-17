"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuperAdminBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supportAccountId, setSupportAccountId] = useState<string | null>(null);
  const [supportOrgName, setSupportOrgName] = useState<string | null>(null);

  useEffect(() => {
    // Check search params or cookies for support session
    const urlViewAs = searchParams.get("view_as");
    let cookieAccountId: string | null = null;
    let cookieOrgName: string | null = null;

    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";").reduce<Record<string, string>>((acc, cookie) => {
        const [k, v] = cookie.trim().split("=");
        if (k && v) acc[k] = decodeURIComponent(v);
        return acc;
      }, {});

      cookieAccountId = cookies["wacrm_support_account_id"] || null;
      cookieOrgName = cookies["wacrm_support_account_name"] || null;
    }

    const activeId = urlViewAs || cookieAccountId;
    if (activeId) {
      setSupportAccountId(activeId);
      setSupportOrgName(cookieOrgName || "Tenant Organization");
    } else {
      setSupportAccountId(null);
      setSupportOrgName(null);
    }
  }, [searchParams]);

  if (!supportAccountId) {
    return null;
  }

  async function handleExitSupport() {
    try {
      // Record exit audit log
      await fetch("/api/super-admin/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tenant.support_view_end",
          targetAccountId: supportAccountId,
          details: {
            organization_name: supportOrgName,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to log support exit:", err);
    }

    // Clear cookies
    if (typeof document !== "undefined") {
      document.cookie = "wacrm_support_account_id=; path=/; max-age=0";
      document.cookie = "wacrm_support_account_name=; path=/; max-age=0";
    }

    setSupportAccountId(null);
    router.push(`/super-admin/organizations/${supportAccountId}`);
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-300 backdrop-blur">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold text-amber-200 uppercase tracking-wider text-[11px] mr-2">
            Support Mode Active:
          </span>
          <span>
            Viewing tenant workspace for{" "}
            <strong className="text-white font-medium">{supportOrgName}</strong>. Live mutations are
            logged in the SaaS audit trail.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExitSupport}
          className="h-7 px-2.5 text-xs bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:text-white"
        >
          <LogOut className="mr-1.5 h-3 w-3" />
          Exit Support View
        </Button>
      </div>
    </div>
  );
}
