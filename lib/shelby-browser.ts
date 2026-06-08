"use client";

import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network } from "@aptos-labs/ts-sdk";

let shelbyBrowserClient: ShelbyClient | null = null;

export function getShelbyBrowserClient(): ShelbyClient {
  if (!shelbyBrowserClient) {
    const apiKey = process.env.NEXT_PUBLIC_APTOS_API_KEY || "";
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
