"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  MessageSquare,
  Radio,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SuperAdminStats {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  totalMessages: number;
  messagesLast24h: number;
  connectedWhatsApp: number;
}

interface RecentOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_tier: string;
  created_at: string;
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [recentOrgs, setRecentOrgs] = useState<RecentOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/super-admin/stats");
      if (!res.ok) {
        throw new Error("Failed to load platform statistics");
      }
      const data = await res.json();
      setStats(data.metrics);
      setRecentOrgs(data.recentOrganizations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Platform Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time multi-tenant monitoring, system throughput, and customer organizations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
            className="h-9 border-border text-xs"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/super-admin/organizations">
            <Button size="sm" className="h-9 text-xs bg-purple-600 hover:bg-purple-700 text-white">
              Manage Organizations
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Organizations */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Organizations
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : stats?.totalOrganizations ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="text-emerald-500 font-medium">
                {stats?.activeOrganizations ?? 0} active
              </span>
              <span>•</span>
              <span className="text-red-400 font-medium">
                {stats?.suspendedOrganizations ?? 0} suspended
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total CRM Users */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total CRM Users
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : stats?.totalUsers ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all customer organizations
            </p>
          </CardContent>
        </Card>

        {/* 24-Hour Message Throughput */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              24h Message Volume
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : stats?.messagesLast24h ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats?.totalMessages ?? 0} all-time messages
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp Numbers Connected */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active WhatsApp Numbers
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Radio className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "..." : stats?.connectedWhatsApp ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Connected Cloud API instances
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border bg-card hover:border-border/80 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-base">Customer Organizations Directory</CardTitle>
            </div>
            <CardDescription>
              Search, inspect, and manage all tenant organizations subscribing to the CRM platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/super-admin/organizations">
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>View All Organizations</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border bg-card hover:border-border/80 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">Immutable Security Audit Logs</CardTitle>
            </div>
            <CardDescription>
              Inspect all administrator operations, suspension records, and view-as support sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/super-admin/audit-logs">
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>View Audit Trail</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Organizations Section */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recently Registered Organizations</CardTitle>
            <CardDescription>Latest tenants onboarded to the platform</CardDescription>
          </div>
          <Link href="/super-admin/organizations" className="text-xs text-primary hover:underline flex items-center gap-1">
            <span>View All</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading organizations...</div>
          ) : recentOrgs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No organizations registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Organization Name</th>
                    <th className="pb-3 font-medium">Slug</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Created Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentOrgs.map((org) => (
                    <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium text-foreground">{org.name}</td>
                      <td className="py-3 text-muted-foreground font-mono text-xs">{org.slug}</td>
                      <td className="py-3">
                        <Badge
                          variant={org.status === "active" ? "default" : "destructive"}
                          className="capitalize text-xs font-normal"
                        >
                          {org.status}
                        </Badge>
                      </td>
                      <td className="py-3 capitalize text-muted-foreground">{org.plan_tier.replace(/_/g, " ")}</td>
                      <td className="py-3 text-muted-foreground text-xs">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <Link href={`/super-admin/organizations/${org.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:text-primary">
                            Inspect
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
