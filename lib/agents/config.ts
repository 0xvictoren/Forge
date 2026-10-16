import { AccountAddress } from "@aptos-labs/ts-sdk";
import { MICROPAYMENTS_DEPLOYER } from "@shelby-protocol/sdk/browser";

/**
 * Public constants for agent pay-per-read. The settlement address is the
 * receiver of every agent channel; it is configured explicitly so clients can
 * be told where to open channels without exposing any key.
 */

/** Fungible asset used for agent payments. 0xa is APT as a fungible asset. */
export const AGENT_PAYMENT_ASSET = (process.env.NEXT_PUBLIC_AGENT_PAYMENT_ASSET || "0xa").toLowerCase();
export const AGENT_PAYMENT_SYMBOL = process.env.NEXT_PUBLIC_AGENT_PAYMENT_SYMBOL || "APT";
export const MICROPAYMENTS_MODULE = MICROPAYMENTS_DEPLOYER;

/** Channels must stay open this long after a read, so Forge can always settle. */
export const CHANNEL_SAFETY_MARGIN_MS = 30 * 60 * 1000;
/** Settlement withdraws any channel expiring within this window. */
export const CHANNEL_SETTLE_BEFORE_EXPIRY_MS = 2 * 60 * 60 * 1000;

export const MICROPAYMENT_HEADER = "x-forge-micropayment";
export const AGENT_SENDER_HEADER = "x-forge-agent";

export function normalizeAddr(addr: string): string {
  return AccountAddress.from(addr, { maxMissingChars: 63 }).toStringLong().toLowerCase();
}
