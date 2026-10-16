"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getAptosBrowserClient } from "@/lib/aptos-browser";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { buildAnchorPayload } from "@/lib/datasets/provenance";
import type { Datasheet } from "@/lib/datasets/manifest";

export type SealPhase = "idle" | "hashing" | "signing" | "confirming" | "done";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

/** Prepare → sign anchor on Aptos → verify. Falls back to offchain sealing on request. */
export function useSealVersion() {
  const { signAndSubmitTransaction, connected } = useWallet();
  const [phase, setPhase] = useState<SealPhase>("idle");

  const seal = useCallback(
    async (versionId: string, datasheet: Partial<Datasheet>, opts?: { offChain?: boolean; changelog?: string }) => {
      setPhase("hashing");
      try {
        const prepared = await post<{
          seal: { datasetId: string; versionNumber: number; manifestHash: string; datasheetHash: string; sealHash: string };
          anchorAvailable: boolean;
        }>(`/api/datasets/versions/${versionId}/seal`, { datasheet, changelog: opts?.changelog });

        if (opts?.offChain || !prepared.anchorAvailable) {
          await post(`/api/datasets/versions/${versionId}/anchor`, { offChain: true });
          setPhase("done");
          return { sealHash: prepared.seal.sealHash, anchorTxHash: null as string | null };
        }

        if (!connected || !signAndSubmitTransaction) throw new Error("Connect your wallet to sign the seal");
        setPhase("signing");
        const res = await signAndSubmitTransaction({ data: buildAnchorPayload(CONTRACT_ADDRESS, prepared.seal) });
        const hash = typeof res === "object" && res && "hash" in res ? String(res.hash) : "";
        if (!hash) throw new Error("Wallet did not return a transaction hash");
        setPhase("confirming");
        await getAptosBrowserClient().waitForTransaction({ transactionHash: hash, options: { checkSuccess: true, timeoutSecs: 60 } });
        await post(`/api/datasets/versions/${versionId}/anchor`, { txHash: hash });
        setPhase("done");
        return { sealHash: prepared.seal.sealHash, anchorTxHash: hash };
      } catch (e) {
        setPhase("idle");
        throw e;
      }
    },
    [connected, signAndSubmitTransaction]
  );

  return { seal, phase, setPhase };
}
