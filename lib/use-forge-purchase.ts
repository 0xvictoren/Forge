"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback } from "react";
import { getAptosBrowserClient } from "./aptos-browser";
import { CONTRACT_ADDRESS } from "./constants";
import {
  buildForgePurchasePayload,
  type ForgePurchaseIntent,
} from "./forge-purchase";

export function useForgePurchase() {
  const { signTransaction, account, connected } = useWallet();

  const settlePurchase = useCallback(
    async (intent: ForgePurchaseIntent): Promise<string> => {
      if (!connected || !account || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const aptos = getAptosBrowserClient();
      const transaction = await aptos.transaction.build.simple({
        sender: account.address.toString(),
        data: buildForgePurchasePayload(CONTRACT_ADDRESS, intent),
        options: {
          expireTimestamp: Math.min(
            Math.floor(new Date(intent.expiresAt).getTime() / 1_000),
            Math.floor(Date.now() / 1_000) + 120
          ),
          gasUnitPrice: 100,
          maxGasAmount: 300_000,
        },
      });

      const signed = await signTransaction({ transactionOrPayload: transaction });
      const authenticator = "authenticator" in signed ? signed.authenticator : signed;
      const pending = await aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator: authenticator,
      });
      await aptos.waitForTransaction({
        transactionHash: pending.hash,
        options: { checkSuccess: true, timeoutSecs: 60 },
      });
      return pending.hash;
    },
    [account, connected, signTransaction]
  );

  return { settlePurchase, connected, account };
}
