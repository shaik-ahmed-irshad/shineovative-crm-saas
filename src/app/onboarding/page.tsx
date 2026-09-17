"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Mail,
  MessageSquare,
  Sparkles,
  Users,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND_CONFIG } from "@/config/brand";

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "GBP", symbol: "£", name: "British Pound" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST - UTC+5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST - UTC+4:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST - UTC+0:00)" },
  { value: "America/New_York", label: "America/New_York (EST - UTC-5:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST - UTC-8:00)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];

export default function OnboardingPage() {
  const router = useRouter();

  // Wizard state: 1: Profile, 2: WhatsApp, 3: Invites, 4: Complete
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Profile
  const [orgName, setOrgName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  // Step 2: WhatsApp
  const [dryRunMode, setDryRunMode] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  // Step 3: Invites
  const [invites, setInvites] = useState<Array<{ email: string; role: "admin" | "agent" | "viewer" }>>([
    { email: "", role: "agent" },
    { email: "", role: "agent" },
  ]);

  useEffect(() => {
    async function fetchAccountData() {
      try {
        const res = await fetch("/api/account/onboarding");
        if (res.ok) {
          const data = await res.json();
          if (data.account) {
            setOrgName(data.account.name || "");
            setCurrency(data.account.defaultCurrency || "USD");
            setTimezone(data.account.timezone || "Asia/Kolkata");
            if (data.account.onboardingCompleted) {
              router.replace("/dashboard");
              return;
            }
          }
          if (data.whatsapp?.connected) {
            setWhatsappConnected(true);
            setDryRunMode(false);
          }
        }
      } catch (err) {
        console.error("Failed to load onboarding info:", err);
      } finally {
        setInitialLoading(false);
      }
    }
    fetchAccountData();
  }, [router]);

  // Step 1 Submit: Save Company Profile
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError("Please enter your organization display name");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName.trim(),
          defaultCurrency: currency,
          timezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submit: WhatsApp or Dry Run
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (dryRunMode) {
      // User chose to explore in test mode
      setStep(3);
      return;
    }

    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      setError("Please fill in all WhatsApp API credentials or enable Dry-Run mode.");
      return;
    }

    setLoading(true);

    try {
      // Connect to official Meta endpoint
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
          access_token: accessToken.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to connect WhatsApp account");
      }

      setWhatsappConnected(true);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "WhatsApp connection failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Submit: Send Invites and Complete Onboarding
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Send invitations for any populated emails
      const validInvites = invites.filter((inv) => inv.email.trim().length > 0);
      for (const inv of validInvites) {
        await fetch("/api/account/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: inv.role,
            label: inv.email.trim(),
          }),
        });
      }

      // Mark onboarding completed in database
      const completeRes = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      if (!completeRes.ok) {
        throw new Error("Could not finalize setup");
      }

      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish onboarding");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Top Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <BrandLogo iconOnly />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome to {BRAND_CONFIG.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Let&apos;s set up your WhatsApp CRM organization in 3 simple steps
        </p>

        {/* Step Indicator */}
        <div className="mt-6 flex items-center gap-2">
          {[
            { num: 1, label: "Profile" },
            { num: 2, label: "WhatsApp" },
            { num: 3, label: "Team" },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                  step === s.num
                    ? "bg-primary text-primary-foreground font-semibold"
                    : step > s.num
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{s.num}</span>
                )}
                <span>{s.label}</span>
              </div>
              {idx < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground/40" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Organization Profile */}
      {step === 1 && (
        <Card className="w-full max-w-lg border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Company Profile & Region</CardTitle>
            </div>
            <CardDescription>
              Configure how your organization appears and formats sales figures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStep1Submit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="orgName">Organization Display Name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="border-border bg-muted"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">Deal & Pipeline Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol}) — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="timezone">Operating Time Zone</Label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={loading} className="mt-2 w-full">
                {loading ? "Saving..." : "Continue to WhatsApp Setup"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: WhatsApp Cloud API */}
      {step === 2 && (
        <Card className="w-full max-w-lg border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Connect WhatsApp API</CardTitle>
              </div>
              <Badge variant={whatsappConnected ? "default" : "outline"}>
                {whatsappConnected ? "Connected" : "Setup Required"}
              </Badge>
            </div>
            <CardDescription>
              Link your official Meta WhatsApp Business Cloud API number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStep2Submit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Dry Run Mode Box */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Explore in Dry-Run Mode
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Still waiting for Meta approval? Enable Dry-Run mode to immediately test
                      CRM pipelines, contacts, and workflows. You can connect your live number anytime later in Settings.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="dryRun"
                    checked={dryRunMode}
                    onChange={(e) => setDryRunMode(e.target.checked)}
                    className="h-5 w-5 rounded border-border text-primary focus:ring-primary mt-1"
                  />
                </div>
              </div>

              {!dryRunMode && (
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phoneId" className="text-xs">
                      Phone Number ID
                    </Label>
                    <Input
                      id="phoneId"
                      placeholder="e.g. 104829104928"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="border-border bg-muted text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wabaId" className="text-xs">
                      WhatsApp Business Account ID (WABA)
                    </Label>
                    <Input
                      id="wabaId"
                      placeholder="e.g. 918239018239"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="border-border bg-muted text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="token" className="text-xs">
                      Permanent Access Token (System User)
                    </Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="EAAG..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="border-border bg-muted text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading
                    ? "Verifying..."
                    : dryRunMode
                      ? "Continue in Dry-Run Mode"
                      : "Save & Verify WhatsApp"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Team Invites */}
      {step === 3 && (
        <Card className="w-full max-w-lg border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Invite Your Sales Team</CardTitle>
            </div>
            <CardDescription>
              Add initial teammates so you can collaborate on customer conversations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStep3Submit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {invites.map((inv, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder={`colleague${idx + 1}@example.com`}
                        value={inv.email}
                        onChange={(e) => {
                          const updated = [...invites];
                          updated[idx].email = e.target.value;
                          setInvites(updated);
                        }}
                        className="border-border bg-muted pl-9 text-sm"
                      />
                    </div>
                    <select
                      value={inv.role}
                      onChange={(e) => {
                        const updated = [...invites];
                        updated[idx].role = e.target.value as "admin" | "agent" | "viewer";
                        setInvites(updated);
                      }}
                      className="flex h-10 w-28 rounded-md border border-border bg-muted px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-muted bg-muted/40 p-3 text-xs text-muted-foreground">
                Teammates will receive an invitation link to join your organization. You can also invite more colleagues anytime from Settings.
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Finalizing Setup..." : "Complete Setup & Launch"}
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Completion Celebration */}
      {step === 4 && (
        <Card className="w-full max-w-md border-border bg-card text-center shadow-lg">
          <CardHeader className="items-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-10 w-10 animate-in zoom-in" />
            </div>
            <CardTitle className="text-2xl text-foreground">You&apos;re All Set!</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Your organization <span className="font-semibold text-foreground">{orgName}</span> is live.
              We&apos;ve automatically seeded your Sales Pipelines, Contact Tags, and Welcome Quick Replies.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-left text-xs space-y-1 text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Sales Pipeline & 5 Stages initialized</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Lead Tags created (Hot Lead, Follow Up, VIP)</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>14-day free trial activated</span>
              </div>
            </div>

            <Button
              onClick={() => router.replace("/dashboard")}
              className="mt-2 h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              Go to Workspace Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
