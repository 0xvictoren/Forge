/**
 * Forge seller CLI: encrypt and upload a whole directory to Shelby, register
 * it on a dataset draft, and optionally seal, anchor and publish it. Built for
 * datasets too large or too numerous for the browser (no wallet prompts: the
 * seller's key signs locally).
 *
 *   FORGE_URL=https://forge.example FORGE_SELLER_KEY=0x… \
 *   npx tsx scripts/forge-upload.mts --dir ./episodes --title "Teleop episodes" --modality ROBOTICS \
 *     [--dataset <id>] [--samples ./samples] [--datasheet sheet.json] [--seal] [--publish pricing.json]
 *
 * datasheet.json: the same fields as the Studio datasheet form.
 * pricing.json:   { "offers": [{ "template": "COMMERCIAL", "priceApt": 25 }],
 *                   "readPricing": { "enabled": true, "pricePerGbApt": 2, "minChargeApt": 0.0001 } }
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { bytesToBase64, generateContentKey, wrapKey } from "../lib/encryption";
import { encryptBlobChunked } from "../lib/datasets/chunked-crypto";
import { sha256Hex } from "../lib/datasets/hash";
import { buildAnchorPayload } from "../lib/datasets/provenance";
import { encodeBlobRef } from "../lib/shelby-public";

/** Single-blob upload limit (one buffer per file in memory). */
const MAX_FILE_BYTES = 1.8 * 1024 ** 3;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true") : undefined;
};
const BASE = (process.env.FORGE_URL || "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.FORGE_SELLER_KEY;
const SHELBY_KEY = process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY || "";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const MIME: Record<string, string> = { csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json", jsonl: "application/x-ndjson", txt: "text/plain", md: "text/markdown", mp4: "video/mp4", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", wav: "audio/wav", mp3: "audio/mpeg", parquet: "application/vnd.apache.parquet", zip: "application/zip" };

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!KEY) die("Set FORGE_SELLER_KEY to the seller wallet's private key");
const dir = flag("dir");
if (!dir) die("--dir is required");

const seller = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(KEY!.trim(), PrivateKeyVariants.Ed25519)) });
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://api.shelbynet.shelby.xyz/v1" }));
const cookies = new Map<string, string>();

async function api<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (pair.slice(i + 1)) cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) die(`${method} ${path}: ${(json as { error?: string }).error || res.status}`);
  return json as T;
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && !e.name.startsWith(".")) out.push(p);
  }
  return out.sort();
}

async function main() {
  const address = seller.accountAddress.toString();
  console.log(`Forge seller CLI · ${BASE} · ${address}`);
  const c = await api<{ walletAddress: string; message: string; nonce: string }>("/api/auth/challenge", "POST", { walletAddress: address });
  const fullMessage = `APTOS\naddress: ${c.walletAddress}\nmessage: ${c.message}\nnonce: ${c.nonce}`;
  await api("/api/auth/session", "POST", { walletAddress: c.walletAddress, message: c.message, nonce: c.nonce, fullMessage, publicKey: seller.publicKey.toString(), signature: seller.sign(new TextEncoder().encode(fullMessage)).toString() });
  console.log("✓ signed in");

  let datasetId = flag("dataset");
  let versionId: string;
  let versionNumber: number;
  if (datasetId) {
    const v = await api<{ version: { id: string; versionNumber: number } }>(`/api/datasets/${datasetId}/versions`, "POST", {});
    versionId = v.version.id;
    versionNumber = v.version.versionNumber;
  } else {
    const title = flag("title") || die("--title is required when creating a dataset");
    const created = await api<{ dataset: { id: string; slug: string }; version: { id: string; versionNumber: number } }>("/api/datasets", "POST", { title, modality: flag("modality") || "MULTIMODAL", visibility: "listed" });
    datasetId = created.dataset.id;
    versionId = created.version.id;
    versionNumber = created.version.versionNumber;
    console.log(`✓ created dataset ${created.dataset.slug}`);
  }

  const shelby = new ShelbyNodeClient({
    network: Network.SHELBYNET,
    apiKey: SHELBY_KEY,
    locationHint: process.env.NEXT_PUBLIC_SHELBY_LOCATION_HINT || "shelbynet-1",
    indexer: { baseUrl: "https://api.shelbynet.shelby.xyz/v1/graphql", apiKey: SHELBY_KEY || undefined },
    rpc: { baseUrl: "https://shelby.shelbynet.shelby.xyz/shelby", apiKey: SHELBY_KEY || undefined },
  } as ConstructorParameters<typeof ShelbyNodeClient>[0]);
  const ownerKey = generateContentKey(); // seller-side wrap; the browser re-derives its own for new uploads

  const groups: { root: string; sample: boolean }[] = [{ root: dir!, sample: false }];
  const samples = flag("samples");
  if (samples) groups.push({ root: samples, sample: true });

  let pending: Record<string, unknown>[] = [];
  const flush = async () => {
    if (!pending.length) return;
    await api(`/api/datasets/versions/${versionId}/files`, "POST", { files: pending });
    pending = [];
  };

  let n = 0;
  for (const g of groups) {
    for (const file of await walk(g.root)) {
      const rel = relative(g.root, file).replace(/\\/g, "/");
      const size = (await stat(file)).size;
      if (size > MAX_FILE_BYTES) die(`${rel} is ${(size / 1024 ** 3).toFixed(2)} GB; split files above 1.8 GB until multipart upload ships`);
      const plain = new Uint8Array(await readFile(file));
      const sha256 = await sha256Hex(plain);
      const ext = rel.split(".").pop()?.toLowerCase() || "";
      const safe = rel.split("/").map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_")).join("/");
      const base = `forge/datasets/${datasetId}/v${versionNumber}/${g.sample ? "samples/" : ""}${safe}`;
      let blobName = base;
      let blob = plain;
      let encryption: Record<string, unknown> | null = null;
      if (!g.sample) {
        const contentKey = generateContentKey();
        const shareKey = generateContentKey();
        blob = new Uint8Array(await (await encryptBlobChunked(new Blob([plain]), contentKey)).arrayBuffer());
        blobName = `${base}.fgc`;
        encryption = { encryptionVersion: 2, wrappedKeyOwner: await wrapKey(contentKey, ownerKey), wrappedKeyShare: await wrapKey(contentKey, shareKey), encryptionShareKey: bytesToBase64(shareKey) };
      }
      await shelby.upload({ blobData: blob, signer: seller, blobName });
      pending.push({ path: rel, sizeBytes: size, mimeType: MIME[ext] || "application/octet-stream", sha256, blobRef: encodeBlobRef(address, blobName), isSample: g.sample, encryption });
      n++;
      console.log(`✓ ${g.sample ? "sample " : ""}${rel} (${(size / 1024 ** 2).toFixed(1)} MB)`);
      if (pending.length >= 50) await flush();
    }
  }
  await flush();
  console.log(`✓ ${n} files stored and registered on v${versionNumber}`);

  if (flag("seal")) {
    const sheetPath = flag("datasheet") || die("--seal needs --datasheet <file.json>");
    const datasheet = JSON.parse(await readFile(sheetPath, "utf8"));
    const prepared = await api<{ seal: Parameters<typeof buildAnchorPayload>[1] }>(`/api/datasets/versions/${versionId}/seal`, "POST", { datasheet });
    const tx = await aptos.transaction.build.simple({ sender: seller.accountAddress, data: buildAnchorPayload(CONTRACT, prepared.seal), options: { maxGasAmount: 20_000, gasUnitPrice: 100 } });
    const sent = await aptos.signAndSubmitTransaction({ signer: seller, transaction: tx });
    await aptos.waitForTransaction({ transactionHash: sent.hash, options: { checkSuccess: true } });
    await api(`/api/datasets/versions/${versionId}/anchor`, "POST", { txHash: sent.hash });
    console.log(`✓ sealed and anchored: ${sent.hash}`);
  }
  const publish = flag("publish");
  if (publish) {
    const pricing = publish === "true" ? {} : JSON.parse(await readFile(publish, "utf8"));
    await api(`/api/datasets/${datasetId}`, "PATCH", { ...pricing, action: "publish" });
    console.log("✓ published");
  }
  console.log(`\nManage it: ${BASE}/studio/${datasetId}`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
