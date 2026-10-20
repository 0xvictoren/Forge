/**
 * End-to-end test of the dataset marketplace against a running server,
 * real Shelby storage and the deployed Forge contract on ShelbyNet.
 *
 *   npx next start -p 3123          (in another terminal)
 *   npx tsx --env-file=.env scripts/e2e-datasets.mts [baseUrl]
 *
 * Creates two throwaway wallets (seller, buyer), funds them from the ShelbyNet
 * faucet, and walks the whole flow: upload → seal → anchor → publish → license
 * (paid, onchain) → fingerprinted download → pipeline pull → trace → revoke →
 * proof → compliance export.
 */
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { bytesToBase64, generateContentKey, wrapKey } from "../lib/encryption";
import { encryptBlobChunked } from "../lib/datasets/chunked-crypto";
import { sha256Hex } from "../lib/datasets/hash";
import { checkOriginality, nodeSample } from "../lib/datasets/originality-node";
import { decodeSignatures, stripSignatures } from "../lib/datasets/fingerprint";
import { buildAnchorPayload } from "../lib/datasets/provenance";
import { buildForgePurchasePayload } from "../lib/forge-purchase";
import { encodeBlobRef } from "../lib/shelby-public";

const BASE = process.argv[2] || "http://localhost:3123";
const NODE = process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://api.shelbynet.shelby.xyz/v1";
const FAUCET = "https://faucet.shelbynet.shelby.xyz/fund";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const SHELBY_KEY =
  process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY || process.env.NEXT_PUBLIC_APTOS_SHELBYNET_API_KEY || "";

const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: NODE }));
let failures = 0;
const ok = (label: string, cond: unknown, detail = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? `, ${detail}` : ""}`);
  if (!cond) failures++;
};
const step = (s: string) => console.log(`\n▸ ${s}`);

class Session {
  cookies = new Map<string, string>();
  constructor(public name: string, public account: Account) {}
  get address() {
    return this.account.accountAddress.toString();
  }
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (init.json !== undefined) headers.set("content-type", "application/json");
    const res = await fetch(BASE + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const v = pair.slice(i + 1);
      if (v) this.cookies.set(pair.slice(0, i), v);
      else this.cookies.delete(pair.slice(0, i));
    }
    return res;
  }
  async json<T = Record<string, unknown>>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const res = await this.req(path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status}: ${JSON.stringify(body)}`);
    return body as T;
  }
  async login() {
    const c = await this.json<{ walletAddress: string; message: string; nonce: string }>("/api/auth/challenge", { method: "POST", json: { walletAddress: this.address } });
    const fullMessage = `APTOS\naddress: ${c.walletAddress}\nmessage: ${c.message}\nnonce: ${c.nonce}`;
    const signature = this.account.sign(new TextEncoder().encode(fullMessage));
    await this.json("/api/auth/session", {
      method: "POST",
      json: { walletAddress: c.walletAddress, message: c.message, nonce: c.nonce, fullMessage, publicKey: this.account.publicKey.toString(), signature: signature.toString() },
    });
  }
}

const SHELBY_USD = "0x77d85d72f484a3284a2838de007e220a6587b95a535d1844c53c387afb23b0b6";
const funderKey = process.env.E2E_FUNDER_KEY || process.env.SHELBY_SIGNER_PRIVATE_KEY;
const funder = funderKey
  ? Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(funderKey.trim(), PrivateKeyVariants.Ed25519)) })
  : null;

async function faucet(addr: string, asset?: string, amount = 100_000_000) {
  const res = await fetch(asset ? `${FAUCET}?asset=${asset}` : FAUCET, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, amount }) });
  const body = (await res.json().catch(() => ({}))) as { txn_hashes?: string[]; message?: string };
  for (const h of body.txn_hashes || []) await aptos.waitForTransaction({ transactionHash: h.startsWith("0x") ? h : `0x${h}` });
  return !!body.txn_hashes?.length;
}

/** Live APT balance from the fullnode (the SDK's indexer-backed lookup can lag). */
async function aptBalance(addr: string) {
  const res = await fetch(`${NODE}/accounts/${addr}/balance/0x1::aptos_coin::AptosCoin`);
  return res.ok ? BigInt(await res.text()) : BigInt(0);
}

const FUND_APT = BigInt(40_000_000);

/** APT from the funder account while it can cover it (no faucet quota), else the faucet; ShelbyUSD from the faucet, falling back to the funder. */
async function fund(addr: string, wantUsd: boolean) {
  if (funder && (await aptBalance(funder.accountAddress.toString())) >= FUND_APT + BigInt(10_000_000)) {
    await submit(funder, { function: "0x1::aptos_account::transfer", functionArguments: [addr, FUND_APT] });
  } else await faucet(addr);
  if (!wantUsd) return;
  const fromFaucet = await faucet(addr, "shelbyusd").catch(() => false);
  if (!fromFaucet && funder && (await usdBalance(funder.accountAddress.toString())) >= BigInt(50_000_000)) {
    await submit(funder, {
      function: "0x1::primary_fungible_store::transfer",
      typeArguments: ["0x1::fungible_asset::Metadata"],
      functionArguments: [SHELBY_USD, addr, 50_000_000],
    });
  }
}

async function usdBalance(addr: string) {
  const [v] = await aptos.view<[string]>({ payload: { function: "0x1::primary_fungible_store::balance", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [addr, SHELBY_USD] } });
  return BigInt(v);
}

async function submit(account: Account, data: Parameters<Aptos["transaction"]["build"]["simple"]>[0]["data"]) {
  const tx = await aptos.transaction.build.simple({ sender: account.accountAddress, data, options: { maxGasAmount: 300_000, gasUnitPrice: 100 } });
  const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: pending.hash, options: { checkSuccess: true } });
  return pending.hash;
}

/** A per-run take id keeps each run's data unique for the originality check. */
const TAKE = Date.now().toString(36);

function makeCsv(rows: number) {
  const lines = ["frame,take,scene,hand_x,hand_y,action"];
  const actions = ["grasp knife", "slice onion", "move bowl", "pour oil", "stir pan"];
  for (let i = 0; i < rows; i++) lines.push(`${1000 + i},${TAKE}${i.toString(36)},kitchen_${String(i % 7).padStart(2, "0")},${(0.2 + (i % 50) / 100).toFixed(3)},${(0.4 + (i % 37) / 100).toFixed(3)},${actions[i % actions.length]}`);
  return lines.join("\n") + "\n";
}

/** Remaining checks that don't need file bytes. */
async function finishWithoutStorage(
  buyer: Session,
  seller: Session,
  datasetId: string,
  versionId: string,
  slug: string,
  certificateSlug: string,
  access: { licenses: { id: string; template: string }[] },
  fileId: string
) {
  step("Pipeline credential (no storage)");
  const cred = await buyer.json<{ token: string; manifestUrl: string }>(`/api/datasets/${datasetId}/credentials`, { method: "POST", json: { versionId } });
  const manifest = await (await fetch(cred.manifestUrl.replace(/^https?:\/\/[^/]+/, BASE), { headers: { authorization: `Bearer ${cred.token}` } })).json();
  ok("manifest returned for bearer token", manifest.files?.length === 1, manifest.license?.template);
  const forged = await fetch(`${BASE}/api/pipeline/manifest`, { headers: { authorization: `Bearer ${cred.token}x` } });
  ok("tampered token is refused", forged.status === 401);

  step("Trace + revoke (no storage)");
  const notOwner = await buyer.req(`/api/datasets/${datasetId}/trace`, { method: "POST", json: { suspect: "x" } });
  ok("buyers cannot run traces", notOwner.status === 404);
  const commercial = access.licenses.find((l) => l.template === "COMMERCIAL")!;
  for (const l of access.licenses) await seller.json(`/api/datasets/${datasetId}/licenses/${l.id}`, { method: "PATCH", json: { action: "revoke", reason: "E2E revoke test" } });
  ok("revoked licences lose access", (await buyer.req(`/api/datasets/files/${fileId}/download`)).status === 403);
  ok("revocation also kills live pipeline tokens", (await fetch(manifest.files[0].url.replace(/^https?:\/\/[^/]+/, BASE), { headers: { authorization: `Bearer ${cred.token}` } })).status === 403);
  for (const l of access.licenses) await seller.json(`/api/datasets/${datasetId}/licenses/${l.id}`, { method: "PATCH", json: { action: "reinstate" } });

  step("Public proof");
  const proof = await (await fetch(`${BASE}/api/datasets/proof/${versionId}`)).json();
  ok("proof recomputes and verifies onchain", proof.verified === true && proof.checks.onChain === true);

  step("Compliance record");
  const { project } = await buyer.json<{ project: { id: string } }>("/api/compliance", { method: "POST", json: { name: "E2E model", modelName: "e2e-grasp" } });
  await buyer.json(`/api/compliance/${project.id}`, { method: "PATCH", json: { licenseIds: [commercial.id] } });
  const record = await buyer.json<{ dataSources: Record<string, unknown[]> }>(`/api/compliance/${project.id}/export`);
  ok("export lists the licence under 2.2", Object.keys(record.dataSources).some((k) => k.startsWith("2.2")));

  step("Pages render");
  for (const [path, needle] of [
    [`/datasets/${slug}`, "Sealed on Aptos"],
    [`/proof/${versionId}`, "exactly what was sealed"],
    [`/license/${certificateSlug}`, "Commercial licence"],
  ] as const) {
    const html = await (await buyer.req(path)).text();
    ok(path, html.includes(needle));
  }
  console.log(`
${failures === 0 ? "ALL CHECKS PASSED (storage skipped)" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures ? 1 : 0);
}

async function main() {
  if (!CONTRACT) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
  console.log(`Forge E2E against ${BASE}\ncontract ${CONTRACT}`);

  step("Wallets");
  const seller = new Session("seller", Account.generate());
  const buyer = new Session("buyer", Account.generate());
  await fund(seller.address, true);
  await fund(buyer.address, false);
  const storage = (await usdBalance(seller.address)) > BigInt(0);
  ok("funded seller + buyer", true, `${seller.address.slice(0, 10)}… / ${buyer.address.slice(0, 10)}…${funder ? " (funder or faucet)" : ""}`);
  if (!storage) console.log("  ! no ShelbyUSD for the seller (faucet quota?), running WITHOUT Shelby storage: placeholder blob refs, content checks skipped");
  await seller.login();
  await buyer.login();
  ok("both signed in with wallet signatures", seller.cookies.has("forge_session") && buyer.cookies.has("forge_session"));

  step("Seller creates a dataset");
  const created = await seller.json<{ dataset: { id: string; slug: string }; version: { id: string; versionNumber: number } }>("/api/datasets", {
    method: "POST",
    json: { title: `E2E kitchen hand-pose ${Date.now().toString(36)}`, tagline: "Automated end-to-end test dataset", description: "Synthetic hand-pose telemetry used by the Forge E2E test.", modality: "TABULAR", tags: ["e2e", "hand-pose"], visibility: "listed" },
  });
  const { id: datasetId, slug } = created.dataset;
  const versionId = created.version.id;
  ok("dataset + draft v1 created", !!datasetId, slug);

  step("Encrypt + upload to Shelby");
  const csv = makeCsv(1200);
  const plain = new TextEncoder().encode(csv);
  const plainSha = await sha256Hex(plain);
  const contentKey = generateContentKey();
  const shareKey = generateContentKey();
  const ownerKey = generateContentKey();
  const cipher = new Uint8Array(await (await encryptBlobChunked(new Blob([plain]), contentKey, { chunkSize: 64 * 1024 })).arrayBuffer());
  const sample = new TextEncoder().encode(makeCsv(20));
  const stamp = Date.now();
  const dataName = `forge/datasets/${datasetId}/v1/frames-${stamp}.csv.fgc`;
  const sampleName = `forge/datasets/${datasetId}/v1/samples/frames-sample-${stamp}.csv`;
  const shelby = new ShelbyNodeClient({
    network: Network.SHELBYNET,
    apiKey: SHELBY_KEY,
    locationHint: process.env.NEXT_PUBLIC_SHELBY_LOCATION_HINT || "shelbynet-1",
    indexer: { baseUrl: "https://api.shelbynet.shelby.xyz/v1/graphql", apiKey: SHELBY_KEY || undefined },
    rpc: { baseUrl: "https://shelby.shelbynet.shelby.xyz/shelby", apiKey: SHELBY_KEY || undefined },
  } as ConstructorParameters<typeof ShelbyNodeClient>[0]);
  if (storage) {
    await shelby.upload({ blobData: cipher, signer: seller.account, blobName: dataName });
    await shelby.upload({ blobData: sample, signer: seller.account, blobName: sampleName });
    ok("ciphertext + sample stored on Shelby", true, `${cipher.byteLength} B encrypted`);
  } else {
    ok("encrypted locally (upload skipped)", cipher.byteLength > plain.byteLength, `${cipher.byteLength} B`);
  }

  step("Originality check");
  const sampleSha = await sha256Hex(sample);
  const post = (url: string, body: unknown) => seller.json(url, { method: "POST", json: body });
  const originality = await checkOriginality(versionId, [nodeSample("frames.csv", plain, plainSha, "text/csv"), nodeSample("frames-sample.csv", sample, sampleSha, "text/csv")], post);
  ok("original data passes", !originality || originality.passed, originality ? `${originality.score}/10` : "check off on this server");

  await seller.json(`/api/datasets/versions/${versionId}/files`, {
    method: "POST",
    json: {
      files: [
        {
          path: "frames.csv",
          sizeBytes: plain.byteLength,
          mimeType: "text/csv",
          sha256: plainSha,
          blobRef: encodeBlobRef(seller.address, dataName),
          isSample: false,
          encryption: { encryptionVersion: 2, wrappedKeyOwner: await wrapKey(contentKey, ownerKey), wrappedKeyShare: await wrapKey(contentKey, shareKey), encryptionShareKey: bytesToBase64(shareKey) },
        },
        { path: "frames-sample.csv", sizeBytes: sample.byteLength, mimeType: "text/csv", sha256: sampleSha, blobRef: encodeBlobRef(seller.address, sampleName), isSample: true, encryption: null },
      ],
    },
  });
  ok("files registered on the draft version", true);

  const rejected = await seller.req(`/api/datasets/versions/${versionId}/files`, {
    method: "POST",
    json: { files: [{ path: "plain.csv", sizeBytes: 1, mimeType: "text/csv", sha256: plainSha, blobRef: encodeBlobRef(seller.address, "x"), isSample: false, encryption: null }] },
  });
  ok("unencrypted data files are refused", rejected.status === 400);

  step("Seal + anchor on Aptos");
  const prepared = await seller.json<{ seal: { datasetId: string; versionNumber: number; manifestHash: string; datasheetHash: string; sealHash: string } }>(`/api/datasets/versions/${versionId}/seal`, {
    method: "POST",
    json: {
      datasheet: {
        sourceType: "SYNTHETIC",
        sourceDescription: "Generated deterministically by the Forge end-to-end test script.",
        rightsStatement: "Created by the test harness; no third-party rights.",
        containsPersonalData: false,
        respectsTdmOptOut: true,
        geographies: [],
        languages: [],
        modalities: ["tabular"],
      },
    },
  });
  const anchorTx = await submit(seller.account, buildAnchorPayload(CONTRACT, prepared.seal));
  await seller.json(`/api/datasets/versions/${versionId}/anchor`, { method: "POST", json: { txHash: anchorTx } });
  ok("seal anchored and verified onchain", true, anchorTx);

  if (originality) {
    step("Re-uploading sealed data is turned back");
    const copy = await seller.json<{ version: { id: string } }>("/api/datasets", {
      method: "POST",
      json: { title: `E2E kitchen hand-pose copy ${TAKE}`, modality: "TABULAR", tags: ["e2e"], visibility: "listed" },
    });
    const reworded = new TextEncoder().encode(csv.toUpperCase());
    const again = await checkOriginality(copy.version.id, [nodeSample("frames.csv", reworded, await sha256Hex(reworded), "text/csv")], post);
    ok("a copy in a new dataset fails the check", !!again && !again.passed, again ? `${again.score}/10` : "");
  }

  const sealedAgain = await seller.req(`/api/datasets/versions/${versionId}/files`, {
    method: "POST",
    json: { files: [{ path: "late.csv", sizeBytes: 1, mimeType: "text/csv", sha256: plainSha, blobRef: encodeBlobRef(seller.address, "y"), isSample: true }] },
  });
  ok("sealed version is immutable", sealedAgain.status === 400);

  await seller.json(`/api/datasets/${datasetId}`, {
    method: "PATCH",
    json: { offers: [{ template: "RESEARCH", priceApt: 0 }, { template: "COMMERCIAL", priceApt: 0.25 }], action: "publish" },
  });
  const listed = await (await fetch(`${BASE}/api/datasets?q=e2e`)).json();
  ok("published and searchable", (listed.datasets as { id: string }[]).some((d) => d.id === datasetId));

  step("Buyer licenses (paid, onchain)");
  const before = await (await fetch(`${BASE}/api/datasets/${datasetId}/access`)).status;
  ok("anonymous access is refused", before === 401);
  const { intent } = await buyer.json<{ intent: Parameters<typeof buildForgePurchasePayload>[1] }>("/api/payment-intents", { method: "POST", json: { kind: "DATASET", targetId: `${datasetId}:COMMERCIAL` } });
  const settleTx = await submit(buyer.account, buildForgePurchasePayload(CONTRACT, intent));
  const lic = await buyer.json<{ license: { id: string; certificateSlug: string } }>(`/api/datasets/${datasetId}/license`, {
    method: "POST",
    json: { template: "COMMERCIAL", intentId: intent.id, txHash: settleTx, orgName: "E2E Robotics Ltd", intendedUse: "Automated test" },
  });
  ok("commercial licence issued after settlement", !!lic.license.certificateSlug, settleTx);
  const replay = await buyer.req(`/api/datasets/${datasetId}/license`, { method: "POST", json: { template: "COMMERCIAL", intentId: intent.id, txHash: settleTx } });
  ok("replaying the same settlement does not mint a second licence", (await replay.json()).duplicate === true);
  const free = await buyer.json<{ license: { certificateSlug: string } }>(`/api/datasets/${datasetId}/license`, { method: "POST", json: { template: "RESEARCH" } });
  ok("free research licence claimed", !!free.license.certificateSlug);

  step("Fingerprinted delivery");
  const access = await buyer.json<{ licenses: { id: string; fingerprintId: string; template: string }[]; versions: { files: { id: string; fingerprinted: boolean }[] }[] }>(`/api/datasets/${datasetId}/access`);
  const file = access.versions[0].files[0];
  ok("access lists the licensed file", !!file && file.fingerprinted);
  const dl = await buyer.req(`/api/datasets/files/${file.id}/download`);
  if (!storage) {
    ok("download fails cleanly when storage is unreachable", dl.status === 502, String(dl.status));
    await finishWithoutStorage(buyer, seller, datasetId, versionId, slug, lic.license.certificateSlug, access, file.id);
    return;
  }
  const delivered = await dl.text();
  const deliveredSha = dl.headers.get("x-forge-delivered-sha256") || "";
  const fps = decodeSignatures(delivered);
  const fingerprintIds = access.licenses.map((l) => l.fingerprintId);
  ok("download succeeded and is marked fingerprinted", dl.ok && dl.headers.get("x-forge-fingerprinted") === "1");
  ok("delivered copy differs from the sealed original", (await sha256Hex(delivered)) !== plainSha);
  ok("delivered copy carries the buyer's invisible signature", [...fps.keys()].some((k) => fingerprintIds.includes(k)), [...fps.keys()].join(","));
  ok("all original rows are intact", csv.trim().split("\n").every((row) => stripSignatures(delivered).includes(row)));

  step("Pipeline credential");
  const cred = await buyer.json<{ token: string; manifestUrl: string }>(`/api/datasets/${datasetId}/credentials`, { method: "POST", json: { versionId } });
  const manifest = await (await fetch(cred.manifestUrl.replace(/^https?:\/\/[^/]+/, BASE), { headers: { authorization: `Bearer ${cred.token}` } })).json();
  ok("manifest returned for bearer token", manifest.files?.length === 1, manifest.license?.template);
  const pulled = await fetch(manifest.files[0].url.replace(/^https?:\/\/[^/]+/, BASE), { headers: { authorization: `Bearer ${cred.token}` } });
  ok("pipeline pull returns the same per-licence copy", (await pulled.text()) === delivered);
  const forged = await fetch(`${BASE}/api/pipeline/manifest`, { headers: { authorization: `Bearer ${cred.token}x` } });
  ok("tampered token is refused", forged.status === 401);

  step("Seller traces a leak");
  const scrubbed = stripSignatures(delivered).split("\n").slice(0, 900).join("\n");
  const trace = await seller.json<{ matches: { licenseId: string; confidence: string; canaryHits: number; canaryTotal: number }[] }>(`/api/datasets/${datasetId}/trace`, { method: "POST", json: { fileId: file.id, suspect: scrubbed } });
  const commercial = access.licenses.find((l) => l.template === "COMMERCIAL")!;
  ok("leak with signatures stripped still traced to the buyer", trace.matches[0]?.licenseId === commercial.id, trace.matches[0] ? `${trace.matches[0].canaryHits}/${trace.matches[0].canaryTotal} canaries` : "no match");
  const byHash = await seller.json<{ matches: { licenseId: string }[] }>(`/api/datasets/${datasetId}/trace`, { method: "POST", json: { sha256: deliveredSha } });
  ok("exact copy traced by SHA-256", byHash.matches[0]?.licenseId === commercial.id);
  const notOwner = await buyer.req(`/api/datasets/${datasetId}/trace`, { method: "POST", json: { suspect: "x" } });
  ok("buyers cannot run traces", notOwner.status === 404);

  step("Revocation");
  for (const l of access.licenses) await seller.json(`/api/datasets/${datasetId}/licenses/${l.id}`, { method: "PATCH", json: { action: "revoke", reason: "E2E revoke test" } });
  const blocked = await buyer.req(`/api/datasets/files/${file.id}/download`);
  ok("revoked licences lose access", blocked.status === 403);
  const blockedPipe = await fetch(manifest.files[0].url.replace(/^https?:\/\/[^/]+/, BASE), { headers: { authorization: `Bearer ${cred.token}` } });
  ok("revocation also kills live pipeline tokens", blockedPipe.status === 403);
  for (const l of access.licenses) await seller.json(`/api/datasets/${datasetId}/licenses/${l.id}`, { method: "PATCH", json: { action: "reinstate" } });

  step("Public proof");
  const proof = await (await fetch(`${BASE}/api/datasets/proof/${versionId}`)).json();
  ok("proof recomputes and verifies onchain", proof.verified === true && proof.checks.onChain === true);

  step("Compliance record");
  const { project } = await buyer.json<{ project: { id: string } }>("/api/compliance", { method: "POST", json: { name: "E2E model", modelName: "e2e-grasp" } });
  await buyer.json(`/api/compliance/${project.id}`, { method: "PATCH", json: { licenseIds: [commercial.id] } });
  const record = await buyer.json<{ dataSources: Record<string, unknown[]> }>(`/api/compliance/${project.id}/export`);
  ok("export lists the licence under 2.2", Object.keys(record.dataSources).some((k) => k.startsWith("2.2")));

  step("Pages render");
  for (const [path, needle] of [
    [`/datasets/${slug}`, "Sealed on Aptos"],
    [`/proof/${versionId}`, "exactly what was sealed"],
    [`/license/${lic.license.certificateSlug}`, "Commercial licence"],
  ] as const) {
    const html = await (await buyer.req(path)).text();
    ok(`${path}`, html.includes(needle));
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  console.log(`dataset ${BASE}/datasets/${slug}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("\nE2E aborted:", e);
  process.exit(1);
});
