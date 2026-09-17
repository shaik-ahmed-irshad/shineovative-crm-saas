import { StripeProvider } from "./providers/stripe";
import { RazorpayProvider } from "./providers/razorpay";
import type { BillingGateway, BillingProvider } from "./types";

export * from "./types";
export * from "./pricing";
export { StripeProvider } from "./providers/stripe";
export { RazorpayProvider } from "./providers/razorpay";

const stripeSingleton = new StripeProvider();
const razorpaySingleton = new RazorpayProvider();

/**
 * Resolve the appropriate billing adapter based on gateway name or account currency.
 *
 * Rules:
 * - 'INR' or 'razorpay' => RazorpayProvider (Domestic UPI, Cards, NetBanking)
 * - 'USD' or 'stripe' or default => StripeProvider (International Cards, Apple Pay, Google Pay)
 */
export function getBillingProvider(gatewayOrCurrency?: string | null): BillingProvider {
  if (!gatewayOrCurrency) return stripeSingleton;

  const normalized = gatewayOrCurrency.toLowerCase();
  if (normalized === "razorpay" || normalized === "inr") {
    return razorpaySingleton;
  }

  return stripeSingleton;
}
