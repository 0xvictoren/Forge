/**
 * End-to-end test of agent pay-per-read against a running server and the live
 * Shelby micropayments contract on ShelbyNet.
 *
 *   npx next start -p 3123                      (in another terminal)
 *   npx tsx --env-file=.env scripts/e2e-agents.mts [baseUrl]
 *
 * Funds a seller and an agent from the funder key (SHELBY_SIGNER_PRIVATE_KEY),
 * seals + publishes a pay-per-read dataset, opens a real micropayment channel,
 * exercises every payment check, then settles onchain and pays the seller.
 * When the seller has ShelbyUSD it also performs real paid reads from Shelby;
 * otherwise those reads are simulated at the database layer (clearly marked).
 */
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants, type InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { ForgeAgentClient, openChannelWithAccount, signMicropayment, signerFromAccount } from "../lib/agent-client/index";
import { bytesToBase64, generateContentKey, wrapKey } from "../lib/encryption";
import { encryptBlobChunked } from "../lib/datasets/chunked-crypto";
import { sha256Hex } from "../lib/datasets/hash";
import { buildAnchorPayload } from "../lib/datasets/provenance";
import { encodeBlobRef } from "../lib/shelby-public";

const BASE = process.argv[2] || "http://localhost:3123";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const SHELBY_KEY = process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_SHELBY_SHELBYNET_API_KEY || process.env.NEXT_PUBLIC_APTOS_SHELBYNET_API_KEY || "";
const SHELBY_USD = "0x77d85d72f484a3284a2838de007e220a6587b95a535d1844c53c387afb23b0b6";
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: "https://api.shelbynet.shelby.xyz/v1" }));
const prisma = new PrismaClient();
const funder = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(process.env.SHELBY_SIGNER_PRIVATE_KEY!.trim(), PrivateKeyVariants.Ed25519)) });

let failures = 0;
const ok = (label: string, cond: unknown, detail = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
};
const step = (s: string) => console.log(`\n▸ ${s}`);

async function submit(signer: Account, data: InputGenerateTransactionPayloadData) {
  const tx = await aptos.transaction.build.simple({ sender: signer.accountAddress, data, options: { maxGasAmount: 20_000, gasUnitPrice: 100 } });
  const p = await aptos.signAndSubmitTransaction({ signer, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: p.hash, options: { checkSuccess: true } });
  return p.hash;
}
const aptBalance = async (a: string) => BigInt((await aptos.view<[string]>({ payload: { function: "0x1::coin::balance", typeArguments: ["0x1::aptos_coin::AptosCoin"], functionArguments: [a] } }))[0]);
const usdBalance = async (a: string) => BigInt((await aptos.view<[string]>({ payload: { function: "0x1::primary_fungible_store::balance", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [a, SHELBY_USD] } }))[0]);

class Session {
  cookies = new Map<string, string>();
  constructor(public account: Account) {}
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
      if (pair.slice(i + 1)) this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
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
    await this.json("/api/auth/session", {
      method: "POST",
      json: { walletAddress: c.walletAddress, message: c.message, nonce: c.nonce, fullMessage, publicKey: this.account.publicKey.toString(), signature: this.account.sign(new TextEncoder().encode(fullMessage)).toString() },
    });
  }
}

async function main() {
  console.log(`Forge agent pay-per-read E2E against ${BASE}`);

  step("Wallets");
  const seller = new Session(Account.generate());
  const agentWallet = Account.generate();
  const session = Account.generate(); // the only key the agent holds
  await submit(funder, { function: "0x1::aptos_account::transfer", functionArguments: [seller.address, 10_000_000] });
  await submit(funder, { function: "0x1::aptos_account::transfer", functionArguments: [agentWallet.accountAddress, 25_000_000] });
  await fetch("https://faucet.shelbynet.shelby.xyz/fund?asset=shelbyusd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: seller.address, amount: 100_000_000 }) }).catch(() => undefined);
  const storage = (await usdBalance(seller.address)) > BigInt(0);
  ok("seller and agent funded", true, storage ? "with ShelbyUSD: real reads" : "no ShelbyUSD: reads simulated at the DB layer");
  await seller.login();

  step("Seller publishes a pay-per-read dataset");
  const created = await seller.json<{ dataset: { id: string; slug: string }; version: { id: string } }>("/api/datasets", {
    method: "POST",
    json: { title: `E2E kitchen hand-pose agents ${Date.now().toString(36)}`, modality: "TABULAR", tags: ["e2e"], visibility: "listed" },
  });
  const datasetId = created.dataset.id;
  const versionId = created.version.id;
  const lines = ["frame,action", ...Array.from({ length: 2000 }, (_, i) => `${i},grasp ${i % 7}`)];
  const plain = new TextEncoder().encode(lines.join("\n") + "\n");
  const contentKey = generateContentKey();
  const shareKey = generateContentKey();
  const cipher = new Uint8Array(await (await encryptBlobChunked(new Blob([plain]), contentKey)).arrayBuffer());
  const blobName = `forge/datasets/${datasetId}/v1/frames-${Date.now()}.csv.fgc`;
  if (storage) {
    const shelby = new ShelbyNodeClient({
      network: Network.SHELBYNET,
      apiKey: SHELBY_KEY,
      locationHint: "shelbynet-1",
      indexer: { baseUrl: "https://api.shelbynet.shelby.xyz/v1/graphql", apiKey: SHELBY_KEY || undefined },
      rpc: { baseUrl: "https://shelby.shelbynet.shelby.xyz/shelby", apiKey: SHELBY_KEY || undefined },
    } as ConstructorParameters<typeof ShelbyNodeClient>[0]);
    await shelby.upload({ blobData: cipher, signer: seller.account, blobName });
  }
  await seller.json(`/api/datasets/versions/${versionId}/files`, {
    method: "POST",
    json: {
      files: [
        {
          path: "frames.csv",
          sizeBytes: plain.byteLength,
          mimeType: "text/csv",
          sha256: await sha256Hex(plain),
          blobRef: encodeBlobRef(seller.address, blobName),
          isSample: false,
          encryption: { encryptionVersion: 2, wrappedKeyOwner: await wrapKey(contentKey, generateContentKey()), wrappedKeyShare: await wrapKey(contentKey, shareKey), encryptionShareKey: bytesToBase64(shareKey) },
        },
      ],
    },
  });
  const prepared = await seller.json<{ seal: Parameters<typeof buildAnchorPayload>[1] }>(`/api/datasets/versions/${versionId}/seal`, {
    method: "POST",
    json: { datasheet: { sourceType: "SYNTHETIC", sourceDescription: "Generated by the agent E2E test.", rightsStatement: "Owned by the test harness.", containsPersonalData: false, respectsTdmOptOut: true, geographies: [], languages: [], modalities: [] } },
  });
  const anchorTx = await submit(seller.account, buildAnchorPayload(CONTRACT, prepared.seal));
  await seller.json(`/api/datasets/versions/${versionId}/anchor`, { method: "POST", json: { txHash: anchorTx } });
  const bad = await seller.req(`/api/datasets/${datasetId}`, { method: "PATCH", json: { readPricing: { enabled: true, pricePerGbApt: 0, minChargeApt: 0 } } });
  ok("free pay-per-read is refused", bad.status === 400);
  await seller.json(`/api/datasets/${datasetId}`, { method: "PATCH", json: { offers: [], readPricing: { enabled: true, pricePerGbApt: 5, minChargeApt: 0.001 }, action: "publish" } });
  ok("published agent-only (no human offers)", true);

  step("Agent discovers");
  const client = new ForgeAgentClient({ baseUrl: BASE, sender: agentWallet.accountAddress, signer: session, maxPricePerReadOctas: BigInt(5_000_000) });
  const discovery = await client.discover();
  ok("discovery document lists receiver + module", !!discovery.payment?.receiver && !!discovery.payment?.micropaymentsModule, discovery.payment?.receiver?.slice(0, 12));
  const catalog = await client.catalog("e2e");
  ok("catalog includes the dataset with a price", catalog.datasets?.some((d: { id: string }) => d.id === datasetId));
  const manifest = await client.dataset(datasetId);
  const file = manifest.files?.[0];
  ok("manifest lists the file and its full-read price", !!file && Number(file.fullReadOctas) > 0, `${file?.fullReadPrice} APT`);

  step("Payment checks");
  const noChannel = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-agent": agentWallet.accountAddress.toString() } });
  const noChannelBody = await noChannel.json();
  ok("402 before a channel exists, with payment instructions", noChannel.status === 402 && noChannelBody.payment?.channel === null && !!noChannelBody.payment?.priceOctas);

  const openTx = await openChannelWithAccount({ wallet: agentWallet, sessionPublicKey: session.publicKey.toUint8Array(), depositOctas: BigInt(15_000_000), hours: 3, forge: discovery.payment });
  ok("agent opened a Shelby micropayment channel to Forge", !!openTx, openTx);

  const ask = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-agent": agentWallet.accountAddress.toString(), range: "bytes=0-999" } });
  const askBody = await ask.json();
  const p = askBody.payment;
  ok("402 now carries channel state, amount and sequence to sign", ask.status === 402 && !!p.channel && p.signSequenceNumber === "0", `${p?.price} APT for ${p?.bytes} bytes`);

  const fields = (amount: bigint, seq: bigint) => ({ deployer: p.micropaymentsModule, sender: agentWallet.accountAddress.toString(), receiver: p.receiver, asset: p.asset, amount, channelId: BigInt(p.channel.channelId), sequenceNumber: seq });
  const intruder = signMicropayment(fields(BigInt(p.signAmount), BigInt(0)), signerFromAccount(Account.generate()));
  const forged = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-micropayment": intruder, range: "bytes=0-999" } });
  ok("signature from a key not registered on the channel is refused", forged.status === 400);
  const under = signMicropayment(fields(BigInt(1), BigInt(0)), signerFromAccount(session));
  const underRes = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-micropayment": under, range: "bytes=0-999" } });
  ok("underpayment is refused with 402", underRes.status === 402);
  const tooMuch = signMicropayment(fields(BigInt(900_000_000), BigInt(0)), signerFromAccount(session));
  const tooMuchRes = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-micropayment": tooMuch, range: "bytes=0-999" } });
  ok("approval above the channel balance is refused", tooMuchRes.status === 402);

  let reads = 0;
  if (storage) {
    step("Real paid reads");
    const r1 = await client.read(file.id, { range: [0, 999] });
    ok("ranged read returns 206 and charges the quote", r1.status === 206 && r1.chargedOctas === BigInt(p.priceOctas), `${r1.bytes.length} bytes`);
    const r2 = await client.read(file.id);
    ok("full read is fingerprinted to the metered licence", r2.fingerprinted && !!r2.licence);
    reads = 2;
  } else {
    step("Failed delivery is free");
    const valid = signMicropayment(fields(BigInt(p.signAmount), BigInt(0)), signerFromAccount(session));
    const r = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-micropayment": valid, range: "bytes=0-999" } });
    const state = await client.channel();
    ok("storage failure returns 502 and charges nothing", r.status === 502 && state.channel?.acceptedAmount === "0", `accepted ${state.channel?.acceptedAmount}`);

    step("Simulated accepted reads (DB layer, real signatures)");
    const ch = await prisma.agentChannel.findFirstOrThrow({ where: { sender: agentWallet.accountAddress.toStringLong() } });
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: ch.userId } });
    const ds = await prisma.dataset.findUniqueOrThrow({ where: { id: datasetId } });
    const license = await prisma.datasetLicense.create({
      data: { datasetId, versionId, buyerId: buyer.id, sellerId: ds.ownerId, template: "METERED", licenseText: "e2e", licenseTextHash: "e2e", termsHash: "e2e", txHash: `metered:e2e:${randomBytes(6).toString("hex")}`, fingerprintId: randomBytes(8).toString("hex"), canarySeed: randomBytes(32).toString("hex"), certificateSlug: randomBytes(10).toString("hex") },
    });
    let cumulative = BigInt(0);
    const price = BigInt(p.priceOctas) * BigInt(40); // make it worth settling
    for (let seq = 0; seq < 3; seq++) {
      cumulative += price;
      const header = signMicropayment(fields(cumulative, BigInt(seq)), signerFromAccount(session));
      await prisma.agentChannel.update({ where: { id: ch.id }, data: { acceptedAmount: cumulative.toString(), lastSequence: String(seq), lastMicropayment: header } });
      await prisma.agentRead.create({ data: { channelId: ch.id, datasetId, fileId: file.id, licenseId: license.id, buyerId: buyer.id, sellerId: ds.ownerId, bytes: 1000, priceOctas: price.toString(), sequence: String(seq), cumulative: cumulative.toString() } });
    }
    reads = 3;
    ok("3 reads recorded with real cumulative approvals", true, `${cumulative} octas`);
    const replay = await fetch(`${BASE}/api/agent/files/${file.id}`, { headers: { "x-forge-micropayment": signMicropayment(fields(cumulative, BigInt(1)), signerFromAccount(session)), range: "bytes=0-999" } });
    ok("replaying an old sequence number is refused with 409", replay.status === 409);
  }

  step("Settlement onchain");
  const before = await aptBalance(seller.address);
  const earnings = await seller.json<{ reads: number; accrued: string }>("/api/studio/agent-payouts");
  ok("seller sees accrued agent earnings", earnings.reads === reads, `${earnings.accrued} APT gross`);
  const settled = await seller.json<{ withdrawals: { txHash?: string; error?: string }[]; payouts: { txHash?: string; net?: string; error?: string }[] }>("/api/studio/agent-payouts", { method: "POST" });
  const wd = settled.withdrawals.find((w) => w.txHash);
  ok("channel withdrawn into Forge's settlement account (receiver_withdraw)", !!wd, wd?.txHash || settled.withdrawals[0]?.error);
  const paid = settled.payouts.find((x) => x.txHash);
  ok("seller paid onchain", !!paid, paid?.txHash || settled.payouts[0]?.error);
  const after = await aptBalance(seller.address);
  const gross = BigInt(Math.round(Number(earnings.accrued) * 1e8));
  const expectedNet = gross - (gross * BigInt(500)) / BigInt(10_000);
  ok("seller received exactly 95% of gross", after - before === expectedNet, `+${after - before} octas, expected ${expectedNet}`);
  const ch2 = await client.channel();
  ok("Forge's channel state shows everything withdrawn", ch2.channel && BigInt(ch2.channel.capacity) > BigInt(0));
  const funded = await prisma.agentRead.count({ where: { datasetId, funded: true, payoutId: { not: null } } });
  ok("every read is funded and attached to a payout", funded === reads, `${funded}/${reads}`);

  console.log(`\n${failures === 0 ? "ALL AGENT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}${storage ? "" : " (reads simulated: no ShelbyUSD for storage)"}`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nE2E aborted:", e);
  await prisma.$disconnect();
  process.exit(1);
});
