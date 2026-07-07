"use client";

import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@aptos-labs/ts-sdk";

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
      aptos: {
        network: Network.SHELBYNET,
        clientConfig: apiKey ? { API_KEY: apiKey } : undefined,
      },
    });
  }
  return shelbyBrowserClient;
}
