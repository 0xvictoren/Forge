"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback } from "react";
import { buildTransferPayload } from "./payments";
import { getAptosBrowserClient } from "./aptos-browser";

/**
 * Sign with the connected wallet, submit via browser-safe Aptos client.
 * Avoids wallet-adapter's internal node fetch (which throws the `url` option error in browser).
 */
export function useAptTransfer() {
  const { signTransaction, account, connected } = useWallet();

  const transfer = useCallback(
    async (
      recipient: string,
      amountApt: number,
      txOptions?: {
        expireTimestamp?: number;
        gasUnitPrice?: number;
        maxGasAmount?: number;
      }
    ): Promise<string> => {
      if (!connected || !account || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      const aptos = getAptosBrowserClient();
      const sender = account.address.toString();
      const nowSec = Math.floor(Date.now() / 1000);
      const transaction = await aptos.transaction.build.simple({
        sender,
        data: buildTransferPayload(recipient, amountApt),
        options: {
          expireTimestamp: txOptions?.expireTimestamp ?? nowSec + 120,
          gasUnitPrice: txOptions?.gasUnitPrice ?? 100,
          maxGasAmount: txOptions?.maxGasAmount ?? 300_000,
        },
      });

      const signed = await signTransaction({ transactionOrPayload: transaction });
      const authenticator =
        "authenticator" in signed ? signed.authenticator : signed;

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
    [connected, account, signTransaction]
  );

  return { transfer, connected, account };
}
