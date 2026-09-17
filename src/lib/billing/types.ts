import type { BillingGateway, BillingCycle, SubscriptionStatus } from "@/types";

export type { BillingGateway, BillingCycle, SubscriptionStatus };

export interface CreateCheckoutSessionParams {
  accountId: string;
  customerEmail: string;
  customerName: string;
  billingCycle: BillingCycle;
  currency: "INR" | "USD";
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  gateway: BillingGateway;
  sessionId: string;
  checkoutUrl?: string; // For Stripe Hosted Checkout redirect
  razorpayOrderId?: string; // For Razorpay Checkout Modal
  razorpayKeyId?: string;
  amount: number; // in paise or cents
  currency: "INR" | "USD";
}

export interface WebhookVerificationResult {
  valid: boolean;
  event?: {
    type: string;
    gateway: BillingGateway;
    accountId?: string;
    customerId?: string;
    subscriptionId?: string;
    invoiceId?: string;
    amountPaid?: number;
    currency?: "INR" | "USD";
    receiptUrl?: string;
    raw: unknown;
  };
  error?: string;
}

export interface BillingProvider {
  readonly gateway: BillingGateway;
  createCustomer(accountId: string, email: string, name: string): Promise<string>;
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  verifyWebhook(payload: string, signature: string, secret?: string): WebhookVerificationResult;
}
