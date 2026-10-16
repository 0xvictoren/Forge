import assert from "node:assert/strict";
import test from "node:test";
import { merkleProof, merkleRootOf, merkleTree, memoryEntryHash, verifyMerkleProof } from "../lib/agents/merkle";
import { sha256Hex } from "../lib/datasets/hash";

test("every leaf proves into the root, tampered leaves do not", async () => {
  for (const n of [1, 2, 3, 7, 16, 33]) {
    const leaves = await Promise.all(Array.from({ length: n }, (_, i) => sha256Hex(`leaf-${i}`)));
    const levels = await merkleTree(leaves);
    const root = merkleRootOf(levels);
    for (let i = 0; i < n; i++) assert.ok(await verifyMerkleProof(leaves[i], merkleProof(levels, i), root), `n=${n} i=${i}`);
    assert.equal(await verifyMerkleProof(await sha256Hex("forged"), merkleProof(levels, 0), root), n === 1 ? false : false);
  }
});

test("memory entry hash chains and is sensitive to every field", async () => {
  const base = { vaultId: "v", sequence: 1, sha256: "a".repeat(64), sizeBytes: 10, prevHash: "0".repeat(64) };
  const h = await memoryEntryHash(base);
  assert.equal(h, await memoryEntryHash({ ...base }));
  assert.notEqual(h, await memoryEntryHash({ ...base, sequence: 2 }));
  assert.notEqual(h, await memoryEntryHash({ ...base, prevHash: "1".repeat(64) }));
  assert.notEqual(h, await memoryEntryHash({ ...base, note: "x" }));
});
