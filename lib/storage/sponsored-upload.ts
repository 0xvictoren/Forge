"use client";

import { AccountAuthenticator, Deserializer, MultiAgentTransaction, type InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
import type { ShelbyClient } from "@shelby-protocol/sdk/browser";

export type SponsorStatus = { enabled: boolean; funded: boolean; remainingBytes: number; dailyBytes: number; sponsor: string };

export async function getSponsorStatus(): Promise<SponsorStatus | null> {
  const res = await fetch("/api/storage/sponsor").catch(() => null);
  return res?.ok ? res.json() : null;
}

type SignTx = (args: { transactionOrPayload: MultiAgentTransaction }) => Promise<unknown>;
type SignAndSubmit = (args: { data: InputGenerateTransactionPayloadData }) => Promise<unknown>;

const hexToBytes = (h: string) => Uint8Array.from((h.replace(/^0x/, "").match(/.{2}/g) || []).map((b) => parseInt(b, 16)));

/**
 * Upload blobs to Shelby with Forge paying the storage fee: commitments are
 * computed here, Forge prepares a two-signer registration, the wallet signs
 * it, Forge co-signs and submits, then chunks go to storage providers and the
 * wallet commits (gas only). Returns the registration transaction hash.
 */
export async function uploadSponsored(opts: {
  client: ShelbyClient;
  versionId: string;
  owner: string;
  blobs: { blobName: string; blobData: Uint8Array }[];
  signTransaction: SignTx;
  signAndSubmitTransaction: SignAndSubmit;
  onProgress?: (blobName: string, stage: "commitments" | "registered" | "stored" | "committed") => void;
  /** Defaults to the page's fetch; scripts pass one that adds the base URL and session cookie. */
  fetch?: typeof fetch;
}) {
  const fetcher = opts.fetch ?? fetch.bind(globalThis);
  // Loaded on demand: the SDK is ESM-only, and this keeps it out of the studio's initial bundle.
  const { createBlobKey, createDefaultErasureCodingProvider, generateCommitments, requiredAckCount, ShelbyBlobClient } = await import("@shelby-protocol/sdk/browser");
  const provider = await createDefaultErasureCodingProvider();
  const prepared = [];
  for (const b of opts.blobs) {
    prepared.push({ ...b, commitments: await generateCommitments(provider, b.blobData) });
    opts.onProgress?.(b.blobName, "commitments");
  }

  const prep = await fetcher("/api/storage/sponsor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      versionId: opts.versionId,
      blobs: prepared.map((p) => ({ blobName: p.blobName, size: p.blobData.length, merkleRoot: p.commitments.blob_merkle_root })),
    }),
  });
  const prepBody = await prep.json();
  if (!prep.ok) throw new Error(prepBody.error || "Sponsorship unavailable");

  const tx = MultiAgentTransaction.deserialize(new Deserializer(hexToBytes(prepBody.transaction)));
  const signed = (await opts.signTransaction({ transactionOrPayload: tx })) as AccountAuthenticator | { authenticator: AccountAuthenticator };
  const authenticator = "authenticator" in signed ? signed.authenticator : signed;

  const sub = await fetcher("/api/storage/sponsor/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId: opts.versionId, transaction: prepBody.transaction, mac: prepBody.mac, senderAuthenticator: authenticator.bcsToHex().toString() }),
  });
  const subBody = (await sub.json()) as { txHash?: string; uids?: { objectName: string; uid: string }[]; error?: string };
  if (!sub.ok || !subBody.uids) throw new Error(subBody.error || "Sponsored registration failed");
  const uidByKey = new Map(subBody.uids.map((u) => [u.objectName, BigInt(u.uid)]));

  const required = requiredAckCount(provider.config.erasure_n);
  for (const p of prepared) {
    opts.onProgress?.(p.blobName, "registered");
    const uid = uidByKey.get(createBlobKey({ account: opts.owner, blobName: p.blobName }));
    if (uid === undefined) throw new Error(`No registration event for ${p.blobName}`);
    const { spAcks } = await opts.client.rpc.putBlobChunksets({ accountAddress: opts.owner, uid, blobData: p.blobData, commitments: p.commitments });
    if (spAcks.length < required) throw new Error(`Only ${spAcks.length} storage providers acknowledged ${p.blobName} (need ${required})`);
    opts.onProgress?.(p.blobName, "stored");
    const res = (await opts.signAndSubmitTransaction({
      data: ShelbyBlobClient.createCommitObjectPayload({ deployer: opts.client.coordination.deployer, uid, blobName: p.blobName, overwrite: true, storageProviderAcks: spAcks }),
    })) as { hash?: string };
    if (res?.hash) await opts.client.coordination.aptos.waitForTransaction({ transactionHash: res.hash, options: { checkSuccess: true } });
    opts.onProgress?.(p.blobName, "committed");
  }
  return subBody.txHash!;
}
