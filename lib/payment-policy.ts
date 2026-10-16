/**
 * Non-intent legacy APT payment surfaces stay fail-closed while Forge moves
 * marketplace settlement to USDC. Core asset/product/BurnLink testnet purchases
 * use server-created intents and are not controlled by this flag.
 */
export function legacyMarketplacePaymentsEnabled(): boolean {
  return process.env.ENABLE_LEGACY_APT_PAYMENTS === "true";
}

export const LEGACY_MARKETPLACE_PAYMENTS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_LEGACY_APT_PAYMENTS === "true";
