import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldAlert,
  Building2,
  ScrollText,
  LayoutDashboard,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: "Platform Super Admin | Shineovative SaaS",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let ctx;
  try {
    ctx = await requireSuperAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Top Super Admin Global Command Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-6">
            <Link href="/super-admin" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600">
                <BrandLogo iconOnly />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-base tracking-tight">
                  Shineovative
                </span>
                <Badge
                  variant="outline"
                  className="border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Super Admin
                </Badge>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-border">
              <Link
                href="/super-admin"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                Dashboard
              </Link>
              <Link
                href="/super-admin/organizations"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Organizations
              </Link>
              <Link
                href="/super-admin/audit-logs"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ScrollText className="h-4 w-4 text-muted-foreground" />
                Audit Logs
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border text-xs text-muted-foreground hover:text-foreground"
              >
                CRM Workspace
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-8 sm:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
