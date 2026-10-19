/**
 * End-to-end test of sponsored storage: a seller with APT for gas but no
 * ShelbyUSD uploads to Shelby while Forge's settlement account pays the fee.
 *
 *   FORGE_SPONSOR_STORAGE=true npx next start -p 3123   (in another terminal)
 *   npx tsx --env-file=.env scripts/e2e-sponsor.mts [baseUrl]
 *
 * Drives the same client helper the studio uses (lib/storage/sponsored-upload).
 */
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants, type InputGenerateTransactionPayloadData, type MultiAgentTransaction } from "@aptos-labs/ts-sdk";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { uploadSponsored, type SponsorStatus } from "../lib/storage/sponsored-upload";

const BASE = process.argv[2] || "http://localhost:3123";
const NODE = "https://api.shelbynet.shelby.xyz/v1";
const SHELBY_KEY = process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY || process.env.NEXT_PUBLIC_APTOS_SHELBYNET_API_KEY || "";
const SHELBY_USD = "0x77d85d72f484a3284a2838de007e220a6587b95a535d1844c53c387afb23b0b6";
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: NODE }));
const funder = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(process.env.SHELBY_SIGNER_PRIVATE_KEY!.trim(), PrivateKeyVariants.Ed25519)) });

let failures = 0;
const ok = (label: string, cond: unknown, detail = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
};
const step = (s: string) => console.log(`\n▸ ${s}`);

const usdBalance = async (a: string) => BigInt((await aptos.view<[string]>({ payload: { function: "0x1::primary_fungible_store::balance", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [a, SHELBY_USD] } }))[0]);

async function submit(signer: Account, data: InputGenerateTransactionPayloadData) {
  const tx = await aptos.transaction.build.simple({ sender: signer.accountAddress, data, options: { maxGasAmount: 20_000, gasUnitPrice: 100 } });
  const p = await aptos.signAndSubmitTransaction({ signer, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: p.hash, options: { checkSuccess: true } });
  return p.hash;
}

class Session {
  cookies = new Map<string, string>();
  constructor(public account: Account) {}
  get address() {
    return this.account.accountAddress.toString();
  }
  /** fetch with the base URL and session cookie, the shape uploadSponsored expects. */
  fetch: typeof fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await fetch(BASE + String(input), { ...init, headers, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (pair.slice(i + 1)) this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
      else this.cookies.delete(pair.slice(0, i));
    }
    return res;
  };
  async json<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown): Promise<T> {
    const res = await this.fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(out)}`);
    return out as T;
  }
  async login() {
    const c = await this.json<{ walletAddress: string; message: string; nonce: string }>("/api/auth/challenge", "POST", { walletAddress: this.address });
    const fullMessage = `APTOS\naddress: ${c.walletAddress}\nmessage: ${c.message}\nnonce: ${c.nonce}`;
    const signature = this.account.sign(new TextEncoder().encode(fullMessage));
    await this.json("/api/auth/session", "POST", { walletAddress: c.walletAddress, message: c.message, nonce: c.nonce, fullMessage, publicKey: this.account.publicKey.toString(), signature: signature.toString() });
  }
}

async function main() {
  console.log(`Forge sponsored storage E2E against ${BASE}`);

  step("Seller with gas but no ShelbyUSD");
  const seller = new Session(Account.generate());
  await submit(funder, { function: "0x1::aptos_account::transfer", functionArguments: [seller.address, 8_000_000] });
  ok("seller holds no ShelbyUSD", (await usdBalance(seller.address)) === BigInt(0), `${seller.address.slice(0, 10)}…`);
  await seller.login();

  const status = await seller.json<SponsorStatus>("/api/storage/sponsor");
  ok("sponsorship is enabled and funded", status.enabled && status.funded, `sponsor ${status.sponsor.slice(0, 10)}…, ${status.remainingBytes} B left today`);
  if (!status.enabled) {
    console.log("\nStart the server with FORGE_SPONSOR_STORAGE=true and a settlement account holding ShelbyUSD.");
    process.exit(1);
  }

  const { dataset, version } = await seller.json<{ dataset: { id: string }; version: { id: string } }>("/api/datasets", "POST", {
    title: `E2E sponsored ${Date.now().toString(36)}`,
    tagline: "Sponsored storage test",
    description: "Uploaded with Forge paying the Shelby storage fee.",
    modality: "TABULAR",
    tags: ["e2e"],
    visibility: "private",
  });
  ok("draft dataset created", !!version.id);

  step("Abuse controls");
  const outside = await seller.fetch("/api/storage/sponsor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ versionId: version.id, blobs: [{ blobName: "someone-else/file.bin", size: 10, merkleRoot: `0x${"ab".repeat(32)}` }] }),
  });
  ok("blob outside the seller's draft path is refused", outside.status === 400, (await outside.json()).error);
  const forged = await seller.fetch("/api/storage/sponsor/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ versionId: version.id, transaction: "00", mac: "0".repeat(64), senderAuthenticator: "00" }),
  });
  ok("transaction not prepared for this session is refused", forged.status === 400, (await forged.json()).error);

  step("Sponsored upload");
  const shelby = new ShelbyClient({
    network: Network.SHELBYNET,
    apiKey: SHELBY_KEY,
    locationHint: process.env.NEXT_PUBLIC_SHELBY_LOCATION_HINT || "shelbynet-1",
    indexer: { baseUrl: "https://api.shelbynet.shelby.xyz/v1/graphql", apiKey: SHELBY_KEY || undefined },
    rpc: { baseUrl: "https://shelby.shelbynet.shelby.xyz/shelby", apiKey: SHELBY_KEY || undefined },
  } as ConstructorParameters<typeof ShelbyClient>[0]);
  const blobName = `forge/datasets/${dataset.id}/v1/sponsored-${Date.now()}.bin`;
  const blobData = new Uint8Array(40_000).map((_, i) => (i * 31 + 7) & 0xff);
  const sponsorUsdBefore = await usdBalance(status.sponsor);
  const stages: string[] = [];
  const txHash = await uploadSponsored({
    client: shelby,
    versionId: version.id,
    owner: seller.address,
    blobs: [{ blobName, blobData }],
    fetch: seller.fetch,
    signTransaction: async ({ transactionOrPayload }: { transactionOrPayload: MultiAgentTransaction }) => aptos.transaction.sign({ signer: seller.account, transaction: transactionOrPayload }),
    signAndSubmitTransaction: async ({ data }) => ({ hash: await submit(seller.account, data) }),
    onProgress: (_, stage) => stages.push(stage),
  });
  ok("registered with Forge as co-signer, stored and committed", stages.join(",") === "commitments,registered,stored,committed", txHash);

  const sponsorUsdAfter = await usdBalance(status.sponsor);
  ok("Forge paid the storage fee", sponsorUsdAfter < sponsorUsdBefore, `${sponsorUsdBefore - sponsorUsdAfter} ShelbyUSD units`);
  ok("seller still holds no ShelbyUSD", (await usdBalance(seller.address)) === BigInt(0));

  const after = await seller.json<SponsorStatus>("/api/storage/sponsor");
  ok("daily quota charged from the onchain registration", after.remainingBytes < status.remainingBytes, `${status.remainingBytes - after.remainingBytes} B used`);

  step("Blob is readable from Shelby");
  const blob = await shelby.download({ account: seller.address, blobName });
  const back = new Uint8Array(await new Response(blob.readable).arrayBuffer());
  ok("downloaded bytes match the upload", back.length === blobData.length && back.every((b, i) => b === blobData[i]), `${back.length} B`);

  console.log(`\n${failures === 0 ? "ALL SPONSOR CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("\nE2E aborted:", e);
  process.exit(1);
});
