import "server-only";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

let shelbyClient: ShelbyNodeClient | null = null;
let shelbySigner: Account | null = null;

export function getShelbyClient(): ShelbyNodeClient {
  if (!shelbyClient) {
    const apiKey =
      process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_APTOS_API_KEY || "";

    if (!apiKey) {
      console.warn("[Shelby] Warning: No SHELBY_API_KEY found in environment");
    }

    shelbyClient = new ShelbyNodeClient({
      network: Network.SHELBYNET,
      apiKey,
      aptos: {
        network: Network.SHELBYNET,
        clientConfig: apiKey ? { API_KEY: apiKey } : undefined,
      },
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
