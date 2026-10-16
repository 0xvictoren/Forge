import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256Hex } from "../lib/datasets/hash";
import { buildManifest, computeSealHash, hashManifest, validateDatasheet } from "../lib/datasets/manifest";
import { decryptBufferChunked, encryptBlobChunked, encryptedSizeFor } from "../lib/datasets/chunked-crypto";
import {
  decodeSignatures,
  detectFingerprintFormat,
  fingerprintContent,
  stripSignatures,
  traceLeak,
} from "../lib/datasets/fingerprint";
import { licenseTextHash, parseOffers, renderLicenseText } from "../lib/datasets/licenses";

const H = (c: string) => c.repeat(64);

test("canonical JSON is key-order independent", () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
});

test("manifest sorts files and the seal changes when any byte changes", async () => {
  const files = [
    { path: "b/2.csv", sizeBytes: 20, sha256: H("b"), mimeType: "text/csv" },
    { path: "\\a\\1.csv", sizeBytes: 10, sha256: H("a"), mimeType: "text/csv" },
  ];
  const m = buildManifest({ datasetId: "ds1", versionNumber: 1, files });
  assert.deepEqual(m.files.map((f) => f.path), ["a/1.csv", "b/2.csv"]);
  assert.equal(m.totals.totalBytes, 30);

  const reordered = buildManifest({ datasetId: "ds1", versionNumber: 1, files: [...files].reverse() });
  assert.equal(await hashManifest(m), await hashManifest(reordered));

  const tampered = buildManifest({
    datasetId: "ds1",
    versionNumber: 1,
    files: [files[0], { ...files[1], sha256: H("c") }],
  });
  const seal = (mh: string) => computeSealHash({ datasetId: "ds1", versionNumber: 1, manifestHash: mh, datasheetHash: H("d") });
  assert.notEqual(await seal(await hashManifest(m)), await seal(await hashManifest(tampered)));
});

test("manifest rejects duplicate paths", () => {
  assert.throws(() =>
    buildManifest({
      datasetId: "x",
      versionNumber: 1,
      files: [
        { path: "a.csv", sizeBytes: 1, sha256: H("a"), mimeType: "" },
        { path: "/a.csv", sizeBytes: 1, sha256: H("a"), mimeType: "" },
      ],
    })
  );
});

test("datasheet requires consent basis when personal data is present", () => {
  const base = {
    sourceType: "SELF_COLLECTED",
    sourceDescription: "Recorded in our own kitchen lab.",
    rightsStatement: "We own all recordings outright.",
    containsPersonalData: true,
  };
  assert.equal(validateDatasheet(base).ok, false);
  assert.equal(validateDatasheet({ ...base, consentBasis: "Signed releases" }).ok, true);
});

test("chunked encryption round-trips across chunk boundaries and detects tampering", async () => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  for (const size of [0, 1, 1023, 1024, 4096 + 7]) {
    const plain = crypto.getRandomValues(new Uint8Array(size));
    const enc = new Uint8Array(await (await encryptBlobChunked(new Blob([plain]), key, { chunkSize: 1024 })).arrayBuffer());
    assert.equal(enc.byteLength, encryptedSizeFor(size, 1024));
    assert.deepEqual(await decryptBufferChunked(enc, key), plain);
  }
  const plain = crypto.getRandomValues(new Uint8Array(3000));
  const enc = new Uint8Array(await (await encryptBlobChunked(new Blob([plain]), key, { chunkSize: 1024 })).arrayBuffer());
  // Truncating the final chunk must fail (AAD binds the last-chunk flag).
  await assert.rejects(decryptBufferChunked(enc.slice(0, 17 + 1040), key));
  const flipped = enc.slice();
  flipped[40] ^= 1;
  await assert.rejects(decryptBufferChunked(flipped, key));
});

function csv(rows: number) {
  const lines = ["id,city,temp_c,label"];
  for (let i = 0; i < rows; i++) lines.push(`${i},Lagos street ${i},${(20 + (i % 9) * 0.5).toFixed(1)},clear sky`);
  return lines.join("\n") + "\n";
}

test("CSV fingerprint is deterministic per licence and different across licences", async () => {
  const text = csv(500);
  const a = { seedHex: "aa".repeat(32), fingerprintId: "0123456789abcdef", fileId: "f1" };
  const b = { seedHex: "bb".repeat(32), fingerprintId: "fedcba9876543210", fileId: "f1" };
  const a1 = await fingerprintContent(text, "csv", a);
  const a2 = await fingerprintContent(text, "csv", a);
  const b1 = await fingerprintContent(text, "csv", b);
  assert.equal(a1.text, a2.text);
  assert.notEqual(a1.text, b1.text);
  assert.ok(a1.canaries.length >= 1);
  assert.equal(a1.text.split("\n").length, text.split("\n").length + a1.canaries.length);
  assert.equal(decodeSignatures(a1.text).get(a.fingerprintId), a1.canaries.length);
});

test("trace identifies the leaker even after invisible marks are stripped", async () => {
  const text = csv(800);
  const lic = [
    { licenseId: "L1", seedHex: "11".repeat(32), fingerprintId: "1111111111111111" },
    { licenseId: "L2", seedHex: "22".repeat(32), fingerprintId: "2222222222222222" },
  ];
  const copies = await Promise.all(
    lic.map((l) => fingerprintContent(text, "csv", { seedHex: l.seedHex, fingerprintId: l.fingerprintId, fileId: "f" }))
  );
  const candidates = lic.map((l, i) => ({ licenseId: l.licenseId, fingerprintId: l.fingerprintId, canaries: copies[i].canaries }));

  const leaked = copies[1].text.split("\n").slice(0, 900).join("\n");
  const full = traceLeak(leaked, candidates);
  assert.equal(full[0].licenseId, "L2");

  const scrubbed = traceLeak(stripSignatures(copies[1].text), candidates);
  assert.equal(scrubbed.length, 1);
  assert.equal(scrubbed[0].licenseId, "L2");
  assert.equal(scrubbed[0].signatureHits, 0);
  assert.ok(scrubbed[0].canaryHits > 0);

  assert.equal(traceLeak(text, candidates).length, 0);
});

test("JSONL and text formats carry the signature", async () => {
  const jsonl = Array.from({ length: 50 }, (_, i) => JSON.stringify({ id: i, caption: `a person slicing onions ${i}`, score: 0.5 })).join("\n");
  const ctx = { seedHex: "33".repeat(32), fingerprintId: "abcdefabcdefabcd", fileId: "j" };
  const out = await fingerprintContent(jsonl, "jsonl", ctx);
  assert.ok(decodeSignatures(out.text).has(ctx.fingerprintId));
  out.text.split("\n").forEach((l) => JSON.parse(l));

  const txt = await fingerprintContent("first line of transcript here\nsecond line of transcript here\n", "text", ctx);
  assert.ok(decodeSignatures(txt.text).has(ctx.fingerprintId));
  assert.equal(detectFingerprintFormat("clip.mp4", "video/mp4"), "binary");
});

test("licence offers are sanitised and licence text hash is stable", async () => {
  assert.deepEqual(
    parseOffers([{ template: "EXCLUSIVE", priceApt: 50 }, { template: "RESEARCH", priceApt: 1 }, { template: "BOGUS", priceApt: 1 }, { template: "RESEARCH", priceApt: 2 }]),
    [
      { template: "RESEARCH", priceApt: 1 },
      { template: "EXCLUSIVE", priceApt: 50 },
    ]
  );
  const text = renderLicenseText({ template: "COMMERCIAL", datasetTitle: "T", datasetId: "d", versionNumber: 1, sealHash: H("e"), sellerName: "S" });
  assert.equal(await licenseTextHash(text), await licenseTextHash(text));
  assert.match(await sha256Hex("x"), /^[0-9a-f]{64}$/);
});

test("streaming decryptor matches buffer decryption for arbitrary input splits", async () => {
  const { decryptStreamChunked } = await import("../lib/datasets/chunked-crypto");
  const key = crypto.getRandomValues(new Uint8Array(32));
  const plain = crypto.getRandomValues(new Uint8Array(5000));
  const enc = new Uint8Array(await (await encryptBlobChunked(new Blob([plain]), key, { chunkSize: 1024 })).arrayBuffer());
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < enc.length; i += 333) controller.enqueue(enc.slice(i, i + 333));
      controller.close();
    },
  });
  const out = new Uint8Array(await new Response(source.pipeThrough(decryptStreamChunked(key))).arrayBuffer());
  assert.deepEqual(out, plain);
});
