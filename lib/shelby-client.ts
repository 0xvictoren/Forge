import "server-only";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import {
  SHELBY_INDEXER_URL,
  SHELBY_LOCATION_HINT,
  SHELBY_RPC_URL,
} from "./constants-shelby";

let shelbyClient: ShelbyNodeClient | null = null;
let shelbySigner: Account | null = null;

export function getShelbyClient(): ShelbyNodeClient {
  if (!shelbyClient) {
    // Support the documented ShelbyNet keys provided by user + common fallbacks
    const apiKey =
      process.env.SHELBY_API_KEY ||
      process.env.NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY ||
      process.env.NEXT_PUBLIC_APTOS_SHELBYNET_API_KEY ||
      process.env.NEXT_PUBLIC_APTOS_API_KEY ||
      "";

    if (!apiKey) {
      console.warn("[Shelby] Warning: No SHELBY_API_KEY (or NEXT_PUBLIC_*_SHELBYNET_API_KEY) found in environment");
    }

    shelbyClient = new ShelbyNodeClient({
      network: Network.SHELBYNET,
      apiKey,
      locationHint: SHELBY_LOCATION_HINT,
      indexer: { baseUrl: SHELBY_INDEXER_URL, apiKey: apiKey || undefined },
      rpc: { baseUrl: SHELBY_RPC_URL, apiKey: apiKey || undefined },
    });
  }
  return shelbyClient;
}

function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (trimmed.startsWith("ed25519-priv-")) {
    return trimmed.replace("ed25519-priv-", "");
  }
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function getShelbySigner(): Account | null {
  const key = process.env.SHELBY_SIGNER_PRIVATE_KEY;
  if (!key) return null;
  if (!shelbySigner) {
    shelbySigner = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(normalizePrivateKey(key)),
    });
  }
  return shelbySigner;
}

export function isShelbyConfigured(): boolean {
  return !!getShelbySigner();
}
