"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Ban, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingAlertBanner() {
  const [status, setStatus] = useState<string | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function checkSubscription() {
      try {
        const res = await fetch("/api/billing/subscription");
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setStatus(data.status);
            setTrialDaysRemaining(data.trialDaysRemaining);
          }
        }
      } catch {
        // Silently swallow in case of network offline
      }
    }
    checkSubscription();
    return () => {
      mounted = false;
    };
  }, []);

  if (!status) return null;

  // 1. Past due payment (grace period warning)
  if (status === "past_due") {
    return (
      <div className="flex items-center justify-between border-b border-red-500/30 bg-red-500/15 px-4 py-2 text-xs text-red-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span>
            <strong>Payment Overdue:</strong> Your last subscription charge could not be completed.
            Please update your payment method to avoid outbound WhatsApp service pauses.
          </span>
        </div>
        <Link href="/settings?tab=billing">
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Resolve Payment
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  // 2. Trial expiring soon (3 days or fewer)
  if (status === "trialing" && trialDaysRemaining !== null && trialDaysRemaining <= 3) {
    return (
      <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-xs text-amber-300">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            <strong>Trial Expiring:</strong> Your 14-day free trial ends in{" "}
            <strong>{trialDaysRemaining === 0 ? "less than 24 hours" : `${trialDaysRemaining} days`}</strong>.
            Subscribe to the All-In-One Plan to keep your WhatsApp automation running without interruption.
          </span>
        </div>
        <Link href="/settings?tab=billing">
          <Button
            size="sm"
            className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
          >
            Lock In Plan
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  // 3. Subscription cancelled / read-only mode
  if (status === "cancelled") {
    return (
      <div className="flex items-center justify-between border-b border-purple-500/30 bg-purple-500/15 px-4 py-2 text-xs text-purple-300">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-purple-400 shrink-0" />
          <span>
            <strong>Subscription Inactive:</strong> Your workspace is in read-only mode. Re-subscribe to resume outbound messaging.
          </span>
        </div>
        <Link href="/settings?tab=billing">
          <Button
            size="sm"
            className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium"
          >
            Reactivate Plan
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}
