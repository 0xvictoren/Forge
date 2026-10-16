import { canonicalJson, sha256Hex } from "@/lib/datasets/hash";

/**
 * Sorted-pair SHA-256 Merkle tree over hex leaves. Sorting each pair means a
 * proof is just the list of sibling hashes, no left/right flags needed.
 */
async function pair(a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return sha256Hex(`${x}${y}`);
}

export async function merkleTree(leaves: string[]): Promise<string[][]> {
  if (!leaves.length) throw new Error("Merkle tree needs at least one leaf");
  const levels: string[][] = [leaves.map((l) => l.toLowerCase())];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(i + 1 < prev.length ? await pair(prev[i], prev[i + 1]) : prev[i]);
    levels.push(next);
  }
  return levels;
}

export function merkleRootOf(levels: string[][]) {
  return levels[levels.length - 1][0];
}

export function merkleProof(levels: string[][], index: number): string[] {
  const proof: string[] = [];
  let i = index;
  for (let l = 0; l < levels.length - 1; l++) {
    const sibling = i % 2 === 0 ? i + 1 : i - 1;
    if (sibling < levels[l].length) proof.push(levels[l][sibling]);
    i = Math.floor(i / 2);
  }
  return proof;
}

export async function verifyMerkleProof(leaf: string, proof: string[], root: string) {
  let h = leaf.toLowerCase();
  for (const s of proof) h = await pair(h, s);
  return h === root.toLowerCase();
}

export const ZERO_HASH = "0".repeat(64);

/** The hash that chains a memory checkpoint to the one before it. */
export function memoryEntryHash(e: { vaultId: string; sequence: number; sha256: string; sizeBytes: number; blobRef?: string | null; note?: string | null; prevHash: string }) {
  return sha256Hex(
    canonicalJson({
      schema: "forge.memory/v1",
      vaultId: e.vaultId,
      sequence: e.sequence,
      sha256: e.sha256.toLowerCase(),
      sizeBytes: e.sizeBytes,
      blobRef: e.blobRef ?? null,
      note: e.note ?? null,
      prevHash: e.prevHash,
    })
  );
}
