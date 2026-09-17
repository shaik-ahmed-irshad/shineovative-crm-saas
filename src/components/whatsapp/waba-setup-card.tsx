"use client";

import { useEffect, useState } from "react";
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Key,
  Smartphone,
  ShieldCheck,
  Lock,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WabaStatus {
  connected: boolean;
  phoneInfo?: {
    id: string;
    display_phone_number: string;
    verified_name?: string;
    quality_rating?: string;
  };
  config?: {
    phoneNumberId: string;
    wabaId?: string | null;
    registeredAt?: string | null;
    subscribedAppsAt?: string | null;
    status: string;
  };
  message?: string;
}

export function WabaSetupCard() {
  const [data, setData] = useState<WabaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pin, setPin] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/whatsapp/onboarding");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.config) {
          setPhoneNumberId(json.config.phoneNumberId || "");
          setWabaId(json.config.wabaId || "");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load WhatsApp status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneNumberId || !accessToken) {
      setError("Phone Number ID and Access Token are required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim() || undefined,
          access_token: accessToken.trim(),
          pin: pin.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Connection failed");
      }

      setSuccess("WhatsApp Business API connected and verified successfully!");
      setAccessToken("");
      setPin("");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect WhatsApp");
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
          <span>Verifying WhatsApp Cloud API connection...</span>
        </CardContent>
      </Card>
    );
  }

  const isConnected = data?.connected && data?.phoneInfo;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-base">WhatsApp Business API Connection</CardTitle>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={`text-xs font-semibold capitalize ${
              isConnected
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isConnected ? "Connected & Live" : "Not Connected"}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Connect your organization's official WhatsApp Business number via Meta Cloud API with zero cross-talk.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Connected Details Card */}
        {isConnected && data.phoneInfo && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-foreground text-base">
                    {data.phoneInfo.display_phone_number}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.phoneInfo.verified_name || "Verified Business Profile"}
                  </div>
                </div>
              </div>

              {data.phoneInfo.quality_rating && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs capitalize">
                  Quality: {data.phoneInfo.quality_rating}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
                <span className="text-muted-foreground font-mono text-[11px]">
                  Phone ID: {data.config?.phoneNumberId}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(data.config?.phoneNumberId || "", "phoneId")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              {data.config?.wabaId && (
                <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
                  <span className="text-muted-foreground font-mono text-[11px]">
                    WABA ID: {data.config.wabaId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(data.config?.wabaId || "", "wabaId")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connection / Update Form */}
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {isConnected ? "Update Credentials" : "Enter Meta Cloud API Credentials"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone_number_id" className="text-xs font-medium">
                Phone Number ID <span className="text-red-400">*</span>
              </Label>
              <Input
                id="phone_number_id"
                placeholder="e.g., 108492857201948"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="h-9 text-xs border-border bg-background font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="waba_id" className="text-xs font-medium">
                WhatsApp Business Account (WABA) ID
              </Label>
              <Input
                id="waba_id"
                placeholder="e.g., 992834758291048"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="h-9 text-xs border-border bg-background font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="access_token" className="text-xs font-medium">
              Permanent System User Access Token <span className="text-red-400">*</span>
            </Label>
            <Input
              id="access_token"
              type="password"
              placeholder="EAABwzL... (stored securely using AES-256-GCM encryption)"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="h-9 text-xs border-border bg-background font-mono"
              required={!isConnected}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin" className="text-xs font-medium">
              Two-Step Verification 6-Digit PIN (Optional)
            </Label>
            <Input
              id="pin"
              type="password"
              maxLength={6}
              placeholder="6-digit PIN set in WhatsApp Manager"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-9 text-xs border-border bg-background font-mono w-48"
            />
            <p className="text-[11px] text-muted-foreground">
              Required by Meta only if two-step verification is enabled for this phone number.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <a
              href="https://business.facebook.com/wa/manage/phone-numbers/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span>Meta WhatsApp Manager</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <Button
              type="submit"
              size="sm"
              disabled={saving || !phoneNumberId || (!accessToken && !isConnected)}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {saving ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Verifying with Meta...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {isConnected ? "Update & Re-Verify Connection" : "Verify & Connect WhatsApp"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
