/**
 * Shineovative Solutions — Product & Feature Configuration
 *
 * Centralized feature flags and presentation terminology.
 * Controls behavioral deployment variations (e.g. internal vs client deployments).
 */

export const PRODUCT_CONFIG = {
  /** Feature flags controlling deployment capabilities */
  features: {
    /**
     * Whether public self-signup (/signup) is enabled.
     * Default: false for Shineovative internal deployment (favoring team invitations).
     */
    publicSignup: false,
    /** Whether AI Assistant capabilities are enabled */
    aiAssistant: true,
    /** Whether Campaigns (broadcasts) are enabled */
    campaigns: true,
    /** Whether Automations builder is enabled */
    automations: true,
    /** Whether Flows builder is enabled */
    flows: true,
    /** Whether Public API keys management is enabled */
    apiKeys: true,
    /** Whether MCP Server capabilities are enabled */
    mcpServer: true,
  },
  /** Presentation terminology mapping (UI labels) */
  terminology: {
    /** Visible label for sales pipelines (internal route: /pipelines) */
    pipelines: "Deals",
    /** Visible label for message broadcasts (internal route: /broadcasts) */
    broadcasts: "Campaigns",
    /** Visible label for AI agents (internal route: /agents) */
    aiAgents: "AI Assistant",
  },
} as const;

export type ProductConfig = typeof PRODUCT_CONFIG;

/** Helper functions for feature flags */
export function isFeatureEnabled(feature: keyof typeof PRODUCT_CONFIG.features): boolean {
  return PRODUCT_CONFIG.features[feature] ?? true;
}
