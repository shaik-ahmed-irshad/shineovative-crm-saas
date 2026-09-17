"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Building2,
  Clock,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_email: string;
  action: string;
  target_account_id: string | null;
  target_user_id: string | null;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export default function SuperAdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  async function fetchAuditLogs() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== "all") params.set("action", actionFilter);
      if (accountFilter.trim()) params.set("target_account_id", accountFilter.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/super-admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load audit logs");
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter]);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchAuditLogs();
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function getActionBadge(action: string) {
    if (action.includes("suspend")) {
      return (
        <Badge variant="destructive" className="font-mono text-xs bg-red-500/10 text-red-400 border-red-500/20">
          <ShieldAlert className="mr-1 h-3 w-3" />
          {action}
        </Badge>
      );
    }
    if (action.includes("reactivate")) {
      return (
        <Badge variant="outline" className="font-mono text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
          <ShieldCheck className="mr-1 h-3 w-3" />
          {action}
        </Badge>
      );
    }
    if (action.includes("support") || action.includes("impersonate")) {
      return (
        <Badge variant="outline" className="font-mono text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
          <UserCheck className="mr-1 h-3 w-3" />
          {action}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="font-mono text-xs text-muted-foreground border-muted">
        {action}
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-emerald-500" />
            Platform Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Immutable, append-only security logs of all administrative actions and tenant interventions ({total} records)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogs}
            disabled={loading}
            className="h-9 border-border text-xs"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Query Controls */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "all", label: "All Actions" },
              { id: "tenant.suspend", label: "Suspensions" },
              { id: "tenant.reactivate", label: "Reactivations" },
              { id: "tenant.support_view_start", label: "Support Views" },
            ].map((item) => (
              <Button
                key={item.id}
                variant={actionFilter === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter(item.id)}
                className={`h-8 text-xs ${
                  actionFilter === item.id
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <form onSubmit={handleFilterSubmit} className="flex items-center gap-2 w-full md:w-80">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter by target Account UUID..."
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="pl-8 h-9 text-xs border-border bg-background"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-9 text-xs shrink-0">
              Apply
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

      {/* Logs Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
              <span>Loading audit logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No audit logs recorded for the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                    <th className="w-8 py-3 px-3"></th>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-4 font-medium">Actor</th>
                    <th className="py-3 px-4 font-medium">Action</th>
                    <th className="py-3 px-4 font-medium">Target Organization</th>
                    <th className="py-3 px-4 font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-xs">
                  {logs.map((log) => {
                    const isExpanded = expandedRows[log.id];

                    return (
                      <tbody key={log.id} className="group">
                        <tr
                          onClick={() => toggleRow(log.id)}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            <span className="flex items-center gap-1.5 font-mono">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {log.actor_email}
                          </td>
                          <td className="py-3 px-4">
                            {getActionBadge(log.action)}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {log.target_account_id ? (
                              <Link
                                href={`/super-admin/organizations/${log.target_account_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Building2 className="h-3 w-3" />
                                {log.target_account_id.slice(0, 8)}...
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">System-wide</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-xs">
                            {log.ip_address}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-muted/10 border-b border-border/50">
                            <td colSpan={6} className="p-4">
                              <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                                <div className="text-xs font-semibold text-foreground">
                                  Audit Details Payload
                                </div>
                                <pre className="text-xs font-mono text-muted-foreground bg-muted/40 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
