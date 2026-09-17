/**
 * Centralized SaaS Pricing & Plan Configuration
 *
 * Implements the Single All-In-One Plan specification from docs/saas/SAAS_BILLING_AND_TIERS_SPEC.md.
 */

export const PRICING_CONFIG = {
  planId: "all_in_one",
  planName: "All-In-One Plan",
  trialDays: 14,
  currencyDefaults: {
    INR: {
      symbol: "₹",
      name: "Indian Rupee",
      gateway: "razorpay" as const,
      monthly: {
        amount: 2999,
        smallestUnitAmount: 299900, // paise
        display: "₹2,999",
      },
      annual: {
        amount: 28790,
        smallestUnitAmount: 2879000, // paise
        display: "₹28,790",
        monthlyEquivalent: "₹2,399",
        discountPercent: 20,
      },
    },
    USD: {
      symbol: "$",
      name: "US Dollar",
      gateway: "stripe" as const,
      monthly: {
        amount: 39,
        smallestUnitAmount: 3900, // cents
        display: "$39",
      },
      annual: {
        amount: 375,
        smallestUnitAmount: 37500, // cents
        display: "$375",
        monthlyEquivalent: "$31.25",
        discountPercent: 20,
      },
    },
  },
  features: [
    "Unlimited Team Members & Agent Seats",
    "Official WhatsApp Business API (Cloud API Direct)",
    "Unlimited Contacts, Leads & Customer Tags",
    "Multi-Stage Sales Pipelines & Deal Tracking",
    "Drag & Drop Visual Automation Workflows",
    "Shared Team Inbox & Real-time Live Chat",
    "Rich Media Management & Quick Reply Templates",
    "Comprehensive Analytics, Exports & Audit Logs",
    "AI Sales Assistant (BYO OpenAI / OpenRouter Key)",
    "Dedicated High-Throughput Webhook Architecture",
  ],
} as const;

export type SupportedCurrency = "INR" | "USD";

export function getPricingForCurrency(currency: string = "USD") {
  const norm = currency.toUpperCase() === "INR" ? "INR" : "USD";
  return PRICING_CONFIG.currencyDefaults[norm];
}
