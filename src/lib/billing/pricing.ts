import { PRICING_CONFIG, type SupportedCurrency } from "@/config/pricing";
import type { BillingCycle, SubscriptionStatus } from "@/types";

/**
 * Get amount in smallest currency unit (paise for INR, cents for USD).
 */
export function getSmallestUnitAmount(
  cycle: BillingCycle,
  currency: SupportedCurrency = "USD",
): number {
  const normCurrency = currency === "INR" ? "INR" : "USD";
  const planConfig = PRICING_CONFIG.currencyDefaults[normCurrency];
  return cycle === "annual"
    ? planConfig.annual.smallestUnitAmount
    : planConfig.monthly.smallestUnitAmount;
}

/**
 * Get display amount string (e.g., "₹2,999", "$39").
 */
export function getDisplayAmount(
  cycle: BillingCycle,
  currency: SupportedCurrency = "USD",
): string {
  const normCurrency = currency === "INR" ? "INR" : "USD";
  const planConfig = PRICING_CONFIG.currencyDefaults[normCurrency];
  return cycle === "annual"
    ? planConfig.annual.display
    : planConfig.monthly.display;
}

/**
 * Calculate annual savings compared to 12 individual monthly payments.
 */
export function calculateAnnualSavings(currency: SupportedCurrency = "USD") {
  const normCurrency = currency === "INR" ? "INR" : "USD";
  const planConfig = PRICING_CONFIG.currencyDefaults[normCurrency];
  const monthlyAnnualized = planConfig.monthly.amount * 12;
  const annualTotal = planConfig.annual.amount;
  const savings = monthlyAnnualized - annualTotal;
  const percent = Math.round((savings / monthlyAnnualized) * 100);

  return {
    savingsAmount: savings,
    savingsPercent: percent,
    symbol: planConfig.symbol,
    display: `${planConfig.symbol}${savings.toLocaleString()}`,
  };
}

/**
 * Calculate remaining days in the free trial.
 * Returns 0 if trial has expired.
 */
export function calculateTrialDaysRemaining(trialEndsAt?: string | null): number {
  if (!trialEndsAt) return 0;
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Whether a subscription status allows active usage.
 * Both 'trialing' and 'active' grant full access.
 */
export function isSubscriptionActive(status?: SubscriptionStatus | null): boolean {
  if (!status) return false;
  return status === "active" || status === "trialing";
}

/**
 * Whether an account is in a temporary 3-day grace period following a payment failure.
 */
export function isWithinGracePeriod(
  status: SubscriptionStatus,
  updatedAt: string | Date,
  gracePeriodDays = 3,
): boolean {
  if (status !== "past_due") return false;
  const updatedTime = new Date(updatedAt).getTime();
  const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
  return Date.now() - updatedTime < gracePeriodMs;
}
