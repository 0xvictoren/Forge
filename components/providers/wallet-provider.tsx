"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      dappConfig={{
        network: Network.SHELBYNET,
        aptosApiKeys: {
          [Network.SHELBYNET]: process.env.NEXT_PUBLIC_APTOS_API_KEY,
        },
      }}
      onError={(error) => console.error("Wallet error:", error)}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
