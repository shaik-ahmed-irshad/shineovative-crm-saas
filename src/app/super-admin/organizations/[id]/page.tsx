"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Ban,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Radio,
  Users,
  MessageSquare,
  BarChart3,
  ExternalLink,
  ScrollText,
  Clock,
  Globe,
  Coins,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrgDetails {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "past_due" | "cancelled";
    planTier: string;
    defaultCurrency: string;
    timezone: string;
    logoUrl: string | null;
    createdAt: string;
    onboardingCompleted: boolean;
  };
  whatsapp: {
    phone_number_id: string | null;
    waba_id: string | null;
    status: string | null;
    registered_at: string | null;
    subscribed_apps_at: string | null;
    last_registration_error: string | null;
  } | null;
  team: Array<{
    userId: string;
    role: string;
    joinedAt: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
  }>;
  usage: {
    contacts: number;
    pipelines: number;
    deals: number;
    messages: number;
  };
  recentAuditLogs: Array<{
    id: string;
    actor_email: string;
    action: string;
    created_at: string;
    details: Record<string, unknown>;
  }>;
}

export default function SuperAdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.id;

  const [data, setData] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Action Dialog
  const [actionType, setActionType] = useState<"suspend" | "reactivate" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchDetails() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/super-admin/organizations/${orgId}`);
      if (!res.ok) {
        throw new Error("Failed to load organization diagnostics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading organization");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetails();
  }, [orgId]);

  async function handleStatusChange() {
    if (!actionType || !data) return;
    try {
      setActionLoading(true);
      setActionError(null);

      const targetStatus = actionType === "suspend" ? "suspended" : "active";
      const res = await fetch(`/api/super-admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: actionReason.trim() || undefined,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Action failed");
      }

      // Refresh diagnostics
      await fetchDetails();
      setActionType(null);
      setActionReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to execute status change");
    } finally {
      setActionLoading(false);
    }
  }

  // Enter View-As / Support Mode
  async function handleEnterSupportMode() {
    if (!data) return;
    try {
      // Record audit log for entering support mode
      await fetch("/api/super-admin/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tenant.support_view_start",
          targetAccountId: orgId,
          details: {
            organization_name: data.organization.name,
            organization_slug: data.organization.slug,
          },
        }),
      });

      // Set support cookie and redirect to CRM dashboard
      document.cookie = `wacrm_support_account_id=${orgId}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `wacrm_support_account_name=${encodeURIComponent(data.organization.name)}; path=/; max-age=86400; SameSite=Lax`;
      router.push(`/dashboard?view_as=${orgId}`);
    } catch (err) {
      console.error("Failed to start support mode:", err);
      // Still allow navigation
      router.push(`/dashboard?view_as=${orgId}`);
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
        <span>Loading organization diagnostics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Organization Not Found</h2>
          <p className="text-sm text-muted-foreground mt-1">{error || "Unable to find requested tenant."}</p>
        </div>
        <Link href="/super-admin/organizations">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organizations
          </Button>
        </Link>
      </div>
    );
  }

  const { organization, whatsapp, team, usage, recentAuditLogs } = data;
  const isActive = organization.status === "active";
  const isSuspended = organization.status === "suspended";

  return (
    <div className="flex flex-col gap-8">
      {/* Top Bar with Back Navigation & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/super-admin/organizations">
            <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {organization.name}
              </h1>
              <Badge
                variant={isActive ? "default" : isSuspended ? "destructive" : "secondary"}
                className={`capitalize text-xs font-semibold ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : isSuspended
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : ""
                }`}
              >
                {organization.status}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              ID: {organization.id} • Slug: {organization.slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDetails}
            disabled={loading}
            className="h-9 text-xs border-border"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleEnterSupportMode}
            className="h-9 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View in CRM (Support Mode)
          </Button>

          {isSuspended ? (
            <Button
              size="sm"
              onClick={() => {
                setActionType("reactivate");
                setActionReason("");
              }}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Reactivate Organization
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setActionType("suspend");
                setActionReason("");
              }}
              className="h-9 text-xs font-medium"
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              Suspend Organization
            </Button>
          )}
        </div>
      </div>

      {/* Usage KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Contacts
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{usage.contacts}</div>
            <p className="text-xs text-muted-foreground mt-1">Stored CRM contacts</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sales Pipelines
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{usage.pipelines}</div>
            <p className="text-xs text-muted-foreground mt-1">{usage.deals} active deals</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Messages Processed
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{usage.messages}</div>
            <p className="text-xs text-muted-foreground mt-1">Inbound + outbound</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Team Roster
            </CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{team.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Assigned CRM agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Meta WhatsApp Diagnostics & Tenant Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Integration Status */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">WhatsApp Cloud API Connection</CardTitle>
            </div>
            <CardDescription>
              Meta Graph API credentials and webhook subscription status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Connection State:</span>
              <Badge
                variant={whatsapp?.status === "connected" ? "default" : "secondary"}
                className={`capitalize font-mono text-xs ${
                  whatsapp?.status === "connected"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : ""
                }`}
              >
                {whatsapp?.status || "unconfigured"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Phone Number ID:</span>
              <span className="font-mono text-foreground">
                {whatsapp?.phone_number_id || "Not connected"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">WABA Business ID:</span>
              <span className="font-mono text-foreground">
                {whatsapp?.waba_id || "Not connected"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Registered Date:</span>
              <span className="text-foreground">
                {whatsapp?.registered_at
                  ? new Date(whatsapp.registered_at).toLocaleString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Webhook Subscribed:</span>
              <span className="text-foreground">
                {whatsapp?.subscribed_apps_at
                  ? new Date(whatsapp.subscribed_apps_at).toLocaleString()
                  : "Pending"}
              </span>
            </div>
            {whatsapp?.last_registration_error && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-xs">
                Meta Error: {whatsapp.last_registration_error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Configuration Details */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-base">Organization Profile & Settings</CardTitle>
            </div>
            <CardDescription>
              Tenant tenancy configuration, currency, and locale
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" /> Plan Tier:
              </span>
              <Badge variant="outline" className="capitalize text-purple-400 border-purple-500/30">
                {organization.planTier.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> Default Currency:
              </span>
              <span className="font-semibold text-foreground uppercase">
                {organization.defaultCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Timezone:
              </span>
              <span className="text-foreground">{organization.timezone}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Onboarding Status:</span>
              <span className={organization.onboardingCompleted ? "text-emerald-500 font-medium" : "text-amber-500"}>
                {organization.onboardingCompleted ? "Completed" : "Incomplete"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Tenant Created At:</span>
              <span className="text-foreground">
                {new Date(organization.createdAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Roster */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Assigned Team Members ({team.length})</CardTitle>
          </div>
          <CardDescription>
            User accounts with membership credentials inside this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                  <th className="py-2.5 px-4 font-medium">Member</th>
                  <th className="py-2.5 px-4 font-medium">Email</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {team.map((member) => (
                  <tr key={member.userId} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium text-foreground">
                      {member.fullName}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {member.email}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${
                          member.role === "owner"
                            ? "border-amber-500/30 text-amber-400"
                            : member.role === "admin"
                            ? "border-blue-500/30 text-blue-400"
                            : "border-muted text-muted-foreground"
                        }`}
                      >
                        {member.role}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Audit History for this Tenant */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-base">Recent Tenant Administrative Audit Trail</CardTitle>
          </div>
          <CardDescription>
            Audit records targeting this organization in the platform security log
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentAuditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No administrative audit entries recorded for this tenant yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                    <th className="py-2.5 px-4 font-medium">Timestamp</th>
                    <th className="py-2.5 px-4 font-medium">Actor</th>
                    <th className="py-2.5 px-4 font-medium">Action</th>
                    <th className="py-2.5 px-4 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-xs">
                  {recentAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-foreground">
                        {log.actor_email}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground max-w-md truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspend / Reactivate Confirmation Dialog */}
      <Dialog
        open={!!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {actionType === "suspend" ? (
                <>
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  Suspend Organization
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Reactivate Organization
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              {actionType === "suspend" ? (
                <>
                  Suspending <strong className="text-foreground">{organization.name}</strong> will
                  immediately disable dashboard logins for all {team.length} members and stop all
                  outbound messaging.
                </>
              ) : (
                <>
                  Reactivating <strong className="text-foreground">{organization.name}</strong> will
                  restore tenant operations immediately.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-foreground">
              Administrative Reason (Required for audit log)
            </label>
            <Textarea
              placeholder="Provide reason for this action..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="text-xs border-border bg-background resize-none h-20"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionType(null)}
              disabled={actionLoading}
              className="h-8 text-xs border-border"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStatusChange}
              disabled={actionLoading || !actionReason.trim()}
              className={`h-8 text-xs font-semibold ${
                actionType === "suspend"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {actionLoading
                ? "Processing..."
                : actionType === "suspend"
                ? "Confirm Suspension"
                : "Confirm Reactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
