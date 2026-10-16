import "server-only";
import { prisma } from "@/lib/db";
import { getAptosClient, getExplorerUrl } from "@/lib/aptos";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { sha256Hex } from "@/lib/datasets/hash";
import { buildAnchorPayload } from "@/lib/datasets/provenance";
import { getSettlementAccount } from "./channels";
import { memoryEntryHash, merkleProof, merkleRootOf, merkleTree, verifyMerkleProof, ZERO_HASH } from "./merkle";

/** Every memory anchor uses this pseudo dataset id in the Forge contract event. */
export const MEMORY_ANCHOR_ID = "forge-memory";

export async function appendCheckpoint(input: {
  sender: string;
  vault: string;
  sha256: string;
  sizeBytes: number;
  blobRef?: string;
  note?: string;
  agentSignature: string;
}) {
  const vault = await prisma.memoryVault.upsert({
    where: { sender_name: { sender: input.sender, name: input.vault } },
    update: {},
    create: { sender: input.sender, name: input.vault },
  });
  // Optimistic append: the head moves only if nobody else appended first.
  for (let attempt = 0; attempt < 5; attempt++) {
    const head = await prisma.memoryVault.findUniqueOrThrow({ where: { id: vault.id } });
    const sequence = head.headSequence + 1;
    const entryHash = await memoryEntryHash({
      vaultId: vault.id,
      sequence,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      blobRef: input.blobRef,
      note: input.note,
      prevHash: head.headHash,
    });
    const moved = await prisma.memoryVault.updateMany({
      where: { id: vault.id, headSequence: head.headSequence, headHash: head.headHash },
      data: { headSequence: sequence, headHash: entryHash },
    });
    if (moved.count !== 1) continue;
    return prisma.memoryCheckpoint.create({
      data: {
        vaultId: vault.id,
        sequence,
        sha256: input.sha256.toLowerCase(),
        sizeBytes: input.sizeBytes,
        blobRef: input.blobRef,
        note: input.note,
        prevHash: head.headHash,
        entryHash,
        agentSignature: input.agentSignature,
      },
    });
  }
  throw new Error("Vault is busy, retry");
}

/** Re-derive a checkpoint's hash, its link to the previous entry and its onchain anchor. */
export async function verifyCheckpoint(entryHash: string) {
  const cp = await prisma.memoryCheckpoint.findUnique({ where: { entryHash }, include: { vault: true, batch: true } });
  if (!cp) return null;
  const recomputed = await memoryEntryHash({ vaultId: cp.vaultId, sequence: cp.sequence, sha256: cp.sha256, sizeBytes: cp.sizeBytes, blobRef: cp.blobRef, note: cp.note, prevHash: cp.prevHash });
  const prev = cp.sequence > 1 ? await prisma.memoryCheckpoint.findUnique({ where: { vaultId_sequence: { vaultId: cp.vaultId, sequence: cp.sequence - 1 } } }) : null;
  const chained = cp.sequence === 1 ? cp.prevHash === ZERO_HASH : prev?.entryHash === cp.prevHash;
  const anchored = cp.batch ? await verifyMerkleProof(cp.entryHash, cp.merkleProof, cp.batch.rootHash) : null;
  return {
    vault: { name: cp.vault.name, agent: cp.vault.sender },
    checkpoint: { sequence: cp.sequence, sha256: cp.sha256, sizeBytes: cp.sizeBytes, blobRef: cp.blobRef, note: cp.note, recordedAt: cp.createdAt, entryHash: cp.entryHash, prevHash: cp.prevHash },
    checks: { hashMatches: recomputed === cp.entryHash, chainedToPrevious: chained, inAnchoredBatch: anchored },
    anchor: cp.batch
      ? { batch: cp.batch.number, rootHash: cp.batch.rootHash, merkleProof: cp.merkleProof, txHash: cp.batch.txHash, explorer: cp.batch.txHash ? getExplorerUrl(cp.batch.txHash) : null, anchoredAt: cp.batch.createdAt }
      : null,
  };
}

/**
 * Batch every unanchored checkpoint into one Merkle root and anchor it with
 * the Forge contract (signed by the settlement account as notary).
 */
export async function anchorMemoryBatch() {
  const pending = await prisma.memoryCheckpoint.findMany({
    where: { OR: [{ batchId: null }, { batchId: { isSet: false } }] },
    orderBy: { createdAt: "asc" },
    take: 4096,
    select: { id: true, entryHash: true },
  });
  if (!pending.length) return null;
  if (!CONTRACT_ADDRESS) throw new Error("Forge contract address is not configured");
  const levels = await merkleTree(pending.map((p) => p.entryHash));
  const root = merkleRootOf(levels);
  const last = await prisma.memoryAnchorBatch.findFirst({ orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;
  const batch = await prisma.memoryAnchorBatch.create({ data: { number, rootHash: root, count: pending.length } });
  await Promise.all(pending.map((p, i) => prisma.memoryCheckpoint.update({ where: { id: p.id }, data: { batchId: batch.id, merkleProof: merkleProof(levels, i) } })));

  const signer = getSettlementAccount();
  const aptos = getAptosClient();
  const tx = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data: buildAnchorPayload(CONTRACT_ADDRESS, {
      datasetId: MEMORY_ANCHOR_ID,
      versionNumber: number,
      manifestHash: root,
      datasheetHash: await sha256Hex(`count:${pending.length}`),
      sealHash: await sha256Hex(`forge-memory-batch:${number}:${root}`),
    }),
    options: { maxGasAmount: 20_000, gasUnitPrice: 100 },
  });
  const sent = await aptos.signAndSubmitTransaction({ signer, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: sent.hash, options: { checkSuccess: true } });
  await prisma.memoryAnchorBatch.update({ where: { id: batch.id }, data: { txHash: sent.hash } });
  return { batch: number, count: pending.length, root, txHash: sent.hash };
}
