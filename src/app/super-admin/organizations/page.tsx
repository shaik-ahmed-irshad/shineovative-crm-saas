"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  CheckCircle2,
  Ban,
  Eye,
  RefreshCw,
  AlertTriangle,
  Users,
  Calendar,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "past_due" | "cancelled";
  planTier: string;
  defaultCurrency: string;
  timezone: string;
  createdAt: string;
  onboardingCompleted: boolean;
  owner: {
    email: string;
    fullName: string;
  };
  memberCount: number;
}

export default function SuperAdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);

  // Dialog state for Suspend / Reactivate action
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [actionType, setActionType] = useState<"suspend" | "reactivate" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchOrganizations() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/super-admin/organizations?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load organizations");
      }
      const data = await res.json();
      setOrganizations(data.organizations || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching organizations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrganizations();
  }, [statusFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchOrganizations();
  }

  async function handleStatusChange() {
    if (!selectedOrg || !actionType) return;
    try {
      setActionLoading(true);
      setActionError(null);

      const targetStatus = actionType === "suspend" ? "suspended" : "active";
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: actionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }

      // Update local item
      setOrganizations((prev) =>
        prev.map((org) => (org.id === selectedOrg.id ? { ...org, status: targetStatus } : org)),
      );

      // Close dialog
      setSelectedOrg(null);
      setActionType(null);
      setActionReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to perform action");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-purple-500" />
            Customer Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Directory of all multi-tenant customer organizations registered on the platform ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrganizations}
            disabled={loading}
            className="h-9 border-border text-xs"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {["all", "active", "suspended", "past_due"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={`h-8 text-xs capitalize ${
                  statusFilter === status
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {status.replace(/_/g, " ")}
              </Button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs border-border bg-background"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-9 text-xs shrink-0">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Organizations Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
              <span>Loading tenant organizations...</span>
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No organizations found matching the criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                    <th className="py-3 px-4 font-medium">Organization</th>
                    <th className="py-3 px-4 font-medium">Owner</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Plan</th>
                    <th className="py-3 px-4 font-medium">Members</th>
                    <th className="py-3 px-4 font-medium">Created</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {organizations.map((org) => {
                    const isActive = org.status === "active";
                    const isSuspended = org.status === "suspended";

                    return (
                      <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                        {/* Name & Slug */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                              {org.name}
                              {org.onboardingCompleted && (
                                <span title="Onboarding completed" className="text-emerald-500">
                                  ●
                                </span>
                              )}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {org.slug}
                            </span>
                          </div>
                        </td>

                        {/* Owner Profile */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">
                              {org.owner.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {org.owner.email}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              isActive ? "default" : isSuspended ? "destructive" : "secondary"
                            }
                            className={`capitalize text-xs font-medium ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                : isSuspended
                                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                : ""
                            }`}
                          >
                            {org.status.replace(/_/g, " ")}
                          </Badge>
                        </td>

                        {/* Plan Tier */}
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className="border-purple-500/30 bg-purple-500/5 text-purple-400 text-xs font-medium capitalize"
                          >
                            {org.planTier.replace(/_/g, " ")}
                          </Badge>
                        </td>

                        {/* Member Count */}
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {org.memberCount}
                          </span>
                        </td>

                        {/* Created Date */}
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(org.createdAt).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/super-admin/organizations/${org.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                Inspect
                              </Button>
                            </Link>

                            {isSuspended ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setActionType("reactivate");
                                  setActionReason("");
                                }}
                                className="h-8 px-2.5 text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setActionType("suspend");
                                  setActionReason("");
                                }}
                                className="h-8 px-2.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                              >
                                <Ban className="mr-1 h-3.5 w-3.5" />
                                Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspend / Reactivate Confirmation Dialog */}
      <Dialog
        open={!!selectedOrg && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrg(null);
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
                  Suspend Organization Access
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Reactivate Organization Access
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
              {actionType === "suspend" ? (
                <>
                  Suspending <strong className="text-foreground">{selectedOrg?.name}</strong> will
                  immediately revoke tenant member logins and pause all outbound WhatsApp automation.
                  This action is recorded in the platform security audit log.
                </>
              ) : (
                <>
                  Reactivating <strong className="text-foreground">{selectedOrg?.name}</strong> will
                  restore tenant dashboard access and live WhatsApp messaging immediately.
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
              placeholder={
                actionType === "suspend"
                  ? "e.g., Billing default, Terms of Service violation, suspicious bulk spam..."
                  : "e.g., Billing rectified, account verified, ticket #123 resolved..."
              }
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="text-xs border-border bg-background resize-none h-20"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedOrg(null);
                setActionType(null);
              }}
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
