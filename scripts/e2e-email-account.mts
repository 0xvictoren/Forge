/**
 * End-to-end test of the email account path without Privy itself: a fresh key
 * with no APT signs exactly the way the "Forge account" wallet does (raw
 * Ed25519 over the Aptos signing message) and Forge pays the gas.
 *
 *   npx tsx --env-file=.env scripts/e2e-email-account.mts [baseUrl]
 *
 * Checks: wallet-style sign-in message, a sponsored contract call landing
 * onchain from an account that holds 0 APT, and refusal of anything that is
 * not a Forge or Shelby call.
 */
import { Account, Aptos, AptosConfig, AccountAuthenticatorEd25519, generateSigningMessageForTransaction, Network } from "@aptos-labs/ts-sdk";
import { PrismaClient } from "@prisma/client";
import { buildAnchorPayload } from "../lib/datasets/provenance";

const BASE = process.argv[2] || "http://localhost:3123";
const NODE = process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://api.shelbynet.shelby.xyz/v1";
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: NODE }));
const prisma = new PrismaClient();

let failures = 0;
const ok = (label: string, cond: unknown, detail = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? `, ${detail}` : ""}`);
  if (!cond) failures++;
};
const step = (s: string) => console.log(`\n▸ ${s}`);

const account = Account.generate();
const address = account.accountAddress.toString();
const cookies = new Map<string, string>();

async function call(path: string, json?: unknown) {
  const res = await fetch(BASE + path, {
    method: json === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}) },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** What signRawHash does inside Privy: Ed25519 over the given bytes. */
const rawSign = (bytes: Uint8Array) => account.sign(bytes);

async function sponsored(data: Parameters<typeof aptos.transaction.build.simple>[0]["data"]) {
  const tx = await aptos.transaction.build.simple({ sender: address, data, withFeePayer: true });
  const auth = new AccountAuthenticatorEd25519(account.publicKey, rawSign(generateSigningMessageForTransaction(tx)));
  return call("/api/sponsor/gas", { transaction: tx.bcsToHex().toString(), senderAuthenticator: auth.bcsToHex().toString() });
}

let userId: string | null = null;
try {
  console.log(`Forge email-account E2E against ${BASE}`);

  step("Sign in the way the Forge account wallet signs");
  const c = await call("/api/auth/challenge", { walletAddress: address });
  const ch = c.body as { walletAddress: string; message: string; nonce: string };
  const fullMessage = `APTOS\naddress: ${ch.walletAddress}\nmessage: ${ch.message}\nnonce: ${ch.nonce}`;
  const login = await call("/api/auth/session", {
    walletAddress: ch.walletAddress,
    message: ch.message,
    nonce: ch.nonce,
    fullMessage,
    publicKey: account.publicKey.toString(),
    signature: rawSign(new TextEncoder().encode(fullMessage)).toString(),
  });
  userId = (login.body.user as { id?: string } | undefined)?.id ?? null;
  ok("session created from a raw-signed message", login.status === 200 && !!userId);

  step("Wallet users are not sponsored");
  const refused = await sponsored(buildAnchorPayload(CONTRACT, { datasetId: "e2e", versionNumber: 1, manifestHash: "00".repeat(32), datasheetHash: "00".repeat(32), sealHash: "00".repeat(32) }));
  ok("gas refused without a Forge account", refused.status === 403);

  await prisma.user.update({ where: { id: userId! }, data: { privyUserId: `e2e-${Date.now()}` } });

  step("Forge pays gas for an account with 0 APT");
  const res = await fetch(`${NODE}/accounts/${address}/balance/0x1::aptos_coin::AptosCoin`);
  ok("account starts with no APT", !res.ok || (await res.text()) === "0");
  const h = "ab".repeat(32);
  const sent = await sponsored(buildAnchorPayload(CONTRACT, { datasetId: `e2e-email-${Date.now()}`, versionNumber: 1, manifestHash: h, datasheetHash: h, sealHash: h }));
  ok("sponsored transaction accepted", sent.status === 200 && typeof sent.body.hash === "string", String(sent.body.hash || sent.body.error));
  if (typeof sent.body.hash === "string") {
    const done = await aptos.waitForTransaction({ transactionHash: sent.body.hash, options: { checkSuccess: false } });
    ok("landed onchain successfully", "success" in done && done.success, "vm_status" in done ? String(done.vm_status) : "");
  }

  step("Only Forge and Shelby calls are sponsored");
  const transfer = await sponsored({ function: "0x1::aptos_account::transfer", functionArguments: [address, 1] });
  ok("a plain APT transfer is refused", transfer.status === 400, String(transfer.body.error));
} catch (e) {
  console.error("E2E aborted:", e);
  failures++;
} finally {
  if (userId) {
    await prisma.sponsoredGas.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
