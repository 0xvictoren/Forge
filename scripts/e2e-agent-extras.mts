/**
 * Live test of agent identity, feeds, memory vaults and memory anchoring.
 *   npx tsx --env-file=.env scripts/e2e-agent-extras.mts [baseUrl] [datasetId]
 * Needs a pay-per-read dataset (datasetId, or the newest one in the catalog)
 * and a few cents of APT on SHELBY_SIGNER_PRIVATE_KEY.
 */
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { ForgeAgentClient, ForgeAgentExtras, openChannelWithAccount, signAgentRequest, signerFromAccount } from "../lib/agent-client/index";

const BASE = process.argv[2] || "http://localhost:3123";
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: "https://api.shelbynet.shelby.xyz/v1" }));
const funder = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(process.env.SHELBY_SIGNER_PRIVATE_KEY!.trim(), PrivateKeyVariants.Ed25519)) });
let failures = 0;
const ok = (label: string, cond: unknown, detail = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
};

async function main() {
  const agent = Account.generate();
  const session = Account.generate();
  const tx = await aptos.transaction.build.simple({ sender: funder.accountAddress, data: { function: "0x1::aptos_account::transfer", functionArguments: [agent.accountAddress, 3_000_000] }, options: { maxGasAmount: 20_000, gasUnitPrice: 100 } });
  const sent = await aptos.signAndSubmitTransaction({ signer: funder, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: sent.hash });
  const client = new ForgeAgentClient({ baseUrl: BASE, sender: agent.accountAddress, signer: session });
  const discovery = await client.discover();
  await openChannelWithAccount({ wallet: agent, sessionPublicKey: session.publicKey.toUint8Array(), depositOctas: BigInt(500_000), hours: 2, forge: discovery.payment });
  ok("agent channel opened (identity for signed requests)", true);
  const extras = new ForgeAgentExtras(client, signerFromAccount(session));

  console.log("\n▸ Signed requests");
  const forged = await fetch(`${BASE}/api/agent/feeds`, { headers: await signAgentRequest(signerFromAccount(Account.generate()), agent.accountAddress.toString(), "GET", `${BASE}/api/agent/feeds`) });
  ok("request signed by a key not on the channel is refused", forged.status === 401);
  const h = await signAgentRequest(signerFromAccount(session), agent.accountAddress.toString(), "GET", `${BASE}/api/agent/feeds`);
  const first = await fetch(`${BASE}/api/agent/feeds`, { headers: h });
  const replay = await fetch(`${BASE}/api/agent/feeds`, { headers: h });
  ok("valid signature accepted, replay refused", first.status === 200 && replay.status === 401, `${first.status}/${replay.status}`);

  console.log("\n▸ Feeds");
  const catalog = await client.catalog();
  const datasetId = process.argv[3] || catalog.datasets?.[0]?.id;
  ok("a pay-per-read dataset exists to follow", !!datasetId, datasetId);
  const versions = await extras.versions(datasetId, 0);
  ok("versions endpoint lists sealed versions", Array.isArray(versions.versions) && versions.versions.length > 0, `latest v${versions.latest}`);
  const privateHook = await extras.subscribe(datasetId, "https://127.0.0.1/hook").catch((e: Error) => e);
  ok("webhooks to private addresses are refused", privateHook instanceof Error, privateHook instanceof Error ? privateHook.message : "accepted");
  const sub = await extras.subscribe(datasetId, "https://example.com/forge-webhook");
  ok("subscribed with an HMAC secret", !!sub.secret && !!sub.subscription?.id, `from v${sub.subscription?.fromVersion}`);
  const feeds = await extras.feeds();
  ok("subscription listed", feeds.subscriptions?.length === 1);
  await extras.unsubscribe(sub.subscription.id);
  ok("unsubscribed", (await extras.feeds()).subscriptions?.length === 0);

  console.log("\n▸ Memory");
  const a = await extras.remember("research-notes", new TextEncoder().encode("The grasp policy fails on wet surfaces."), { note: "observation 1" });
  const b = await extras.remember("research-notes", new TextEncoder().encode("Switching to suction for wet items."), { note: "decision" });
  ok("two checkpoints appended in sequence", a.checkpoint.sequence === 1 && b.checkpoint.sequence === 2);
  ok("second checkpoint chains to the first", b.checkpoint.prevHash === a.checkpoint.entryHash);
  const v1 = await fetch(`${BASE}/api/agent/memory/verify?entry=${b.checkpoint.entryHash}`).then((r) => r.json());
  ok("public verify recomputes hash and chain", v1.checks?.hashMatches && v1.checks?.chainedToPrevious, "not yet anchored");
  const mine = await extras.memory("research-notes");
  ok("agent can list its own vault", mine.checkpoints?.length === 2);

  console.log("\n▸ Memory anchoring (cron)");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("  - CRON_SECRET not set: skipping anchor run");
  } else {
    const run = await fetch(`${BASE}/api/cron/anchor-memory`, { method: "POST", headers: { authorization: `Bearer ${secret}` } }).then((r) => r.json());
    ok("batch anchored onchain", !!run.anchored?.txHash, run.anchored?.txHash || run.error);
    const v2 = await fetch(`${BASE}/api/agent/memory/verify?entry=${a.checkpoint.entryHash}`).then((r) => r.json());
    ok("checkpoint proves into the anchored Merkle root", v2.checks?.inAnchoredBatch === true, v2.anchor?.txHash);
  }
  console.log(`\n${failures === 0 ? "ALL EXTRAS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("\nE2E aborted:", e);
  process.exit(1);
});
