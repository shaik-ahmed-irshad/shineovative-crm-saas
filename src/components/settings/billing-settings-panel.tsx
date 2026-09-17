"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  RefreshCw,
  Receipt,
  ExternalLink,
  ShieldCheck,
  Ban,
  Lock,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { PRICING_CONFIG, type SupportedCurrency } from "@/config/pricing";
import { calculateAnnualSavings } from "@/lib/billing/pricing";

interface SubscriptionData {
  subscription: {
    gateway: "stripe" | "razorpay";
    plan_code: string;
    billing_cycle: "monthly" | "annual";
    currency: "INR" | "USD";
    status: "trialing" | "active" | "past_due" | "cancelled" | "unpaid";
    current_period_end?: string;
    trial_ends_at?: string | null;
    cancel_at_period_end?: boolean;
  };
  status: "trialing" | "active" | "past_due" | "cancelled" | "unpaid";
  isActive: boolean;
  trialDaysRemaining: number;
  invoices: Array<{
    id: string;
    gateway: string;
    invoice_id: string;
    amount_paid: number;
    currency: string;
    receipt_url: string | null;
    paid_at: string;
  }>;
}

export function BillingSettingsPanel() {
  const { isOwner, isAdmin } = useAuth();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Billing cycle switch: monthly vs annual
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [currency, setCurrency] = useState<SupportedCurrency>("INR");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchBillingData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) {
        throw new Error("Failed to load subscription details");
      }
      const json = await res.json();
      setData(json);
      if (json.subscription?.currency) {
        setCurrency(json.subscription.currency);
      }
      if (json.subscription?.billing_cycle) {
        setBillingCycle(json.subscription.billing_cycle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading billing info");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBillingData();
  }, []);

  async function handleCheckout() {
    if (!isAdmin) return;
    try {
      setCheckoutLoading(true);
      setError(null);
      setMessage(null);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingCycle,
          currency,
          gateway: currency === "INR" ? "razorpay" : "stripe",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to initiate checkout");
      }

      const session = json.session;
      if (session.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      } else {
        setMessage(`Checkout session generated successfully: ${session.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout initiation failed");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!isOwner) return;
    const confirm = window.confirm(
      "Are you sure you want to cancel auto-renewal? Your account will remain active until the end of the current billing cycle.",
    );
    if (!confirm) return;

    try {
      setCancelLoading(true);
      setError(null);
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to cancel subscription");
      }
      setMessage("Auto-renewal has been cancelled. Plan active until period ends.");
      await fetchBillingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>Loading subscription & billing status...</span>
      </div>
    );
  }

  const sub = data?.subscription;
  const status = data?.status || "trialing";
  const isTrial = status === "trialing";
  const isActive = status === "active";
  const isPastDue = status === "past_due";
  const isCancelled = status === "cancelled";

  const pricing = PRICING_CONFIG.currencyDefaults[currency];
  const savings = calculateAnnualSavings(currency);

  return (
    <div className="space-y-6">
      {/* Top Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Subscription & Billing
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your organization plan, payment method, and billing invoices
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchBillingData}
          disabled={loading}
          className="h-8 text-xs border-border"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Subscription Status Banner */}
      {isTrial && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-300 text-sm">
                  14-Day Free Trial Active
                </span>
                <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300 font-mono">
                  {data?.trialDaysRemaining ?? 14} days remaining
                </Badge>
              </div>
              <p className="text-xs text-amber-200/80 mt-1">
                You have full, unrestricted access to all CRM features, live WhatsApp messaging, and unlimited team seats.
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0 font-medium"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Subscribe & Lock In Plan
            </Button>
          )}
        </div>
      )}

      {isActive && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-300 text-sm">
                  All-In-One Plan — Active
                </span>
                <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-300 capitalize">
                  {sub?.billing_cycle} billing
                </Badge>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Next billing date:{" "}
                {sub?.current_period_end
                  ? new Date(sub.current_period_end).toLocaleDateString()
                  : "Automatic Renewal"}
                {sub?.cancel_at_period_end && " (Cancels at cycle end)"}
              </p>
            </div>
          </div>
          {isOwner && !sub?.cancel_at_period_end && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              className="h-8 text-xs border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30"
            >
              Cancel Auto-Renew
            </Button>
          )}
        </div>
      )}

      {isPastDue && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-red-300 text-sm">
                Payment Overdue (Grace Period)
              </span>
              <p className="text-xs text-red-200/80 mt-1">
                Your last payment could not be processed. Please update your payment method to ensure continuous WhatsApp connectivity.
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="text-xs shrink-0 font-medium"
            >
              Pay Now & Resume
            </Button>
          )}
        </div>
      )}

      {/* Plan Card & Pricing Selector */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs mb-2">
                Simple Single Plan
              </Badge>
              <CardTitle className="text-xl font-bold text-foreground">
                {PRICING_CONFIG.planName}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Everything you need to run, automate, and scale your WhatsApp sales operations with 0 limits.
              </CardDescription>
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border">
              <Button
                variant={currency === "INR" ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrency("INR")}
                className={`h-7 px-2.5 text-xs font-medium ${
                  currency === "INR" ? "bg-purple-600 text-white hover:bg-purple-700" : "text-muted-foreground"
                }`}
              >
                ₹ INR (India)
              </Button>
              <Button
                variant={currency === "USD" ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrency("USD")}
                className={`h-7 px-2.5 text-xs font-medium ${
                  currency === "USD" ? "bg-purple-600 text-white hover:bg-purple-700" : "text-muted-foreground"
                }`}
              >
                $ USD (Global)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Monthly vs Annual Toggle */}
          <div className="flex items-center justify-center">
            <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border gap-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  billingCycle === "monthly"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  billingCycle === "annual"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Annual Billing</span>
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Highlight Box */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-foreground">
                  {billingCycle === "annual" ? pricing.annual.display : pricing.monthly.display}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {billingCycle === "annual" ? "year" : "month"}
                </span>
              </div>
              {billingCycle === "annual" && (
                <p className="text-xs text-emerald-400 font-medium mt-1">
                  Equivalent to {pricing.annual.monthlyEquivalent}/mo (Save {savings.display} per year)
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {currency === "INR"
                    ? "Supports UPI, Google Pay, PhonePe, NetBanking & Domestic Cards via Razorpay"
                    : "Supports International Credit/Debit Cards, Apple Pay & Google Pay via Stripe"}
                </span>
              </p>
            </div>

            {isAdmin && (
              <Button
                size="lg"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-6 h-11 shrink-0"
              >
                {checkoutLoading ? (
                  "Initiating Checkout..."
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    {isActive ? "Change Billing Cycle" : "Subscribe Now"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Included Features Grid */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Included in the All-In-One Plan:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {PRICING_CONFIG.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices History Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Payment & Invoice Receipts</CardTitle>
          </div>
          <CardDescription>
            Download receipts and audit past charges for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data?.invoices.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No paid invoices yet. Invoices appear here automatically after your first billing cycle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                    <th className="py-2.5 px-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-medium">Invoice ID</th>
                    <th className="py-2.5 px-4 font-medium">Amount</th>
                    <th className="py-2.5 px-4 font-medium">Gateway</th>
                    <th className="py-2.5 px-4 font-medium text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-xs">
                  {data?.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {new Date(inv.paid_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-foreground font-medium">
                        {inv.invoice_id}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-foreground">
                        {inv.currency === "INR" ? "₹" : "$"}
                        {(inv.amount_paid / 100).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 capitalize text-muted-foreground">
                        {inv.gateway}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {inv.receipt_url ? (
                          <a
                            href={inv.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
