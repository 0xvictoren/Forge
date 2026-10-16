import {
  Aptos,
  AptosConfig,
  ClientConfig,
  Network,
} from "@aptos-labs/ts-sdk";
import { CONTRACT_ADDRESS } from "./constants";

let aptosClient: Aptos | null = null;

export function getAptosClient(): Aptos {
  if (aptosClient) return aptosClient;

  const nodeApiUrl =
    process.env.NEXT_PUBLIC_APTOS_NODE_URL ||
    "https://forge-shelby-cdn.b-cdn.net/";
  const apiKey = process.env.NEXT_PUBLIC_APTOS_API_KEY || "";

  const clientConfig: ClientConfig = apiKey ? { API_KEY: apiKey } : {};

  const config = new AptosConfig({
    fullnode: nodeApiUrl,
    network: Network.SHELBYNET,
    clientConfig,
  });

  aptosClient = new Aptos(config);
  return aptosClient;
}

export function getModuleAddress(): string {
  return CONTRACT_ADDRESS;
}

export async function getAccountBalance(address: string): Promise<number> {
  const aptos = getAptosClient();
  try {
    const resources = await aptos.getAccountAPTAmount({
      accountAddress: address,
    });
    return Number(resources) / 1e8;
  } catch {
    return 0;
  }
}

export function getExplorerUrl(txHash: string): string {
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=shelbynet`;
}

export function getAccountExplorerUrl(address: string): string {
  return `https://explorer.aptoslabs.com/account/${address}?network=shelbynet`;
}

export const forgeModule = {
  settlePurchase: "settle_purchase",
  initializePlatform: "initialize_platform",
};
