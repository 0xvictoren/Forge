"use client";

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

let aptosBrowserClient: Aptos | null = null;

export function getAptosBrowserClient(): Aptos {
  if (!aptosBrowserClient) {
    const apiKey = process.env.NEXT_PUBLIC_APTOS_API_KEY || "";
    aptosBrowserClient = new Aptos(
      new AptosConfig({
        network: Network.CUSTOM,
        fullnode:
          process.env.NEXT_PUBLIC_APTOS_NODE_URL ||
          "https://api.shelbynet.shelby.xyz/v1",
        clientConfig: apiKey ? { API_KEY: apiKey } : undefined,
      })
    );
  }
  return aptosBrowserClient;
}
