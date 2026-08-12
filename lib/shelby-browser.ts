"use client";

import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@aptos-labs/ts-sdk";
import {
  SHELBY_INDEXER_URL,
  SHELBY_LOCATION_HINT,
  SHELBY_RPC_URL,
} from "./constants-shelby";

let shelbyBrowserClient: ShelbyClient | null = null;

export function getShelbyBrowserClient(): ShelbyClient {
  if (!shelbyBrowserClient) {
    // Prefer Shelby-specific public keys for ShelbyNet
    const apiKey =
      process.env.NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY ||
      process.env.NEXT_PUBLIC_APTOS_SHELBYNET_API_KEY ||
      process.env.NEXT_PUBLIC_APTOS_API_KEY ||
      "";
    shelbyBrowserClient = new ShelbyClient({
      network: Network.SHELBYNET,
      apiKey,
      locationHint: SHELBY_LOCATION_HINT,
      indexer: { baseUrl: SHELBY_INDEXER_URL, apiKey: apiKey || undefined },
      rpc: { baseUrl: SHELBY_RPC_URL, apiKey: apiKey || undefined },
    });
  }
  return shelbyBrowserClient;
}
