/**
 * Shineovative Solutions — Brand Configuration
 *
 * Centralized identity configuration for Shineovative WhatsApp CRM.
 * A future client deployment can replace these values via environment or config
 * without modifying UI components.
 */

export const BRAND_CONFIG = {
  /** Visible product display name */
  name: "Shineovative WhatsApp CRM",
  /** Short product name used in narrow UI contexts */
  shortName: "Shineovative CRM",
  /** Company name */
  companyName: "Shineovative Solutions",
  /** Marketing / main website */
  websiteUrl: "https://shineovative.com",
  /** Support contact email */
  supportEmail: "info@shineovative.com",
  /** Support contact phone / WhatsApp */
  supportPhone: "+91 9652006000",
  /** Main application logo configuration */
  logo: {
    src: "/shineovative-assets/shinovative-logo.webp",
    fallbackSrc: "/brand/logo.svg",
    alt: "Shineovative Solutions Logo",
    width: 160,
    height: 40,
  },
  /** App Icon / Favicon configuration */
  favicon: "/shineovative-assets/favicon.ico",
  /** Default metadata description */
  description: "Enterprise WhatsApp CRM by Shineovative Solutions — shared inbox, deals, campaigns, and AI assistant.",
} as const;

export type BrandConfig = typeof BRAND_CONFIG;
