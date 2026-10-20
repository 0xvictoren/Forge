import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { AccountAddress, AccountAuthenticator, Deserializer, EntryFunction, MultiAgentTransaction, TransactionPayloadEntryFunction } from "@aptos-labs/ts-sdk";
import { defaultErasureCodingConfig, expectedTotalChunksets, SHELBY_DEPLOYER, SHELBYUSD_FA_METADATA_ADDRESS, ShelbyBlobClient } from "@shelby-protocol/sdk/node";
import { prisma } from "@/lib/db";
import { getAptosClient } from "@/lib/aptos";
import { SHELBY_LOCATION_HINT } from "@/lib/constants-shelby";
import { getSettlementAccount } from "@/lib/agents/channels";
import { normalizeAddr } from "@/lib/agents/config";

/**
 * Sponsored storage: Forge co-signs Shelby's register_multiple_blobs_with_sponsor
 * so sellers upload without holding ShelbyUSD. The sponsor is the settlement
 * account. Abuse controls: only the seller's own draft dataset paths, an HMAC
 * binding the prepared transaction to the session user, and a daily byte quota.
 */

export const SPONSOR_DAILY_BYTES = Number(process.env.FORGE_SPONSOR_DAILY_BYTES || 2 * 1024 ** 3);
export const SPONSOR_ENABLED = process.env.FORGE_SPONSOR_STORAGE === "true";
const SPONSORED_FUNCTION = "register_multiple_blobs_with_sponsor";

function macSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return `${s}:storage-sponsor`;
}

const mac = (userId: string, txHex: string) => createHmac("sha256", macSecret()).update(`${userId}:${txHex}`).digest("hex");

export async function sponsorStatus(userId: string) {
  const sponsor = getSettlementAccount().accountAddress.toString();
  let usdBalance = BigInt(0);
  try {
    const [v] = await getAptosClient().view<[string]>({
      payload: { function: "0x1::primary_fungible_store::balance", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [sponsor, SHELBYUSD_FA_METADATA_ADDRESS] },
    });
    usdBalance = BigInt(v);
  } catch {
    /* treat as unfunded */
  }
  const used = await prisma.sponsoredUpload.aggregate({ where: { userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, _sum: { bytes: true } });
  const usedBytes = used._sum.bytes ?? 0;
  return {
    enabled: SPONSOR_ENABLED && usdBalance > BigInt(0),
    sponsor: normalizeAddr(sponsor),
    funded: usdBalance > BigInt(0),
    dailyBytes: SPONSOR_DAILY_BYTES,
    remainingBytes: Math.max(0, SPONSOR_DAILY_BYTES - usedBytes),
  };
}

export type SponsorBlob = { blobName: string; size: number; merkleRoot: string };

/** Build the multi-agent registration transaction for the seller to sign. */
export async function prepareSponsoredRegistration(input: { userId: string; wallet: string; versionId: string; blobs: SponsorBlob[] }) {
  if (!SPONSOR_ENABLED) throw new Error("Sponsored storage is not enabled");
  const version = await prisma.datasetVersion.findUnique({ where: { id: input.versionId }, include: { dataset: true } });
  if (!version || version.dataset.ownerId !== input.userId || version.status !== "DRAFT") throw new Error("Draft version not found");
  const prefix = `forge/datasets/${version.datasetId}/v${version.versionNumber}/`;
  if (!input.blobs.length || input.blobs.length > 32) throw new Error("Between 1 and 32 blobs per sponsored batch");
  for (const b of input.blobs) {
    if (!b.blobName.startsWith(prefix) || b.blobName.includes("..")) throw new Error(`Blob ${b.blobName} is outside this dataset version`);
    if (!/^(0x)?[0-9a-f]{64}$/i.test(b.merkleRoot)) throw new Error("Invalid merkle root");
    if (!Number.isInteger(b.size) || b.size <= 0) throw new Error("Invalid blob size");
  }
  const total = input.blobs.reduce((s, b) => s + b.size, 0);
  const status = await sponsorStatus(input.userId);
  if (!status.funded) throw new Error("Forge's storage sponsor is out of ShelbyUSD right now");
  if (total > status.remainingBytes) throw new Error(`Sponsored quota left today: ${status.remainingBytes} bytes`);

  const config = defaultErasureCodingConfig();
  const chunksetSize = config.chunkSizeBytes * config.erasure_k;
  const data = ShelbyBlobClient.createBatchRegisterBlobsPayload({
    account: AccountAddress.from(input.wallet),
    locationHint: SHELBY_LOCATION_HINT,
    blobs: input.blobs.map((b) => ({
      blobName: b.blobName,
      blobSize: b.size,
      blobMerkleRoot: b.merkleRoot.startsWith("0x") ? b.merkleRoot : `0x${b.merkleRoot}`,
      numChunksets: expectedTotalChunksets(b.size, chunksetSize),
    })),
    encoding: config.enumIndex,
    useSponsoredUsdVariant: true,
  });
  const tx = await getAptosClient().transaction.build.multiAgent({
    sender: input.wallet,
    secondarySignerAddresses: [getSettlementAccount().accountAddress],
    data,
    // Forge pays the gas too, so sellers who signed in with email need no APT.
    withFeePayer: true,
    options: { maxGasAmount: 50_000, gasUnitPrice: 100 },
  });
  const txHex = tx.bcsToHex().toString();
  return { transaction: txHex, mac: mac(input.userId, txHex), totalBytes: total };
}

/** Verify, co-sign as sponsor, and submit the seller-signed registration. */
export async function submitSponsoredRegistration(input: { userId: string; wallet: string; versionId: string; transaction: string; mac: string; senderAuthenticator: string }) {
  const expected = Buffer.from(mac(input.userId, input.transaction), "hex");
  const given = Buffer.from(input.mac, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new Error("Transaction was not prepared for this session");

  const hex = (s: string) => Buffer.from(s.replace(/^0x/, ""), "hex");
  const tx = MultiAgentTransaction.deserialize(new Deserializer(hex(input.transaction)));
  const raw = tx.rawTransaction;
  if (normalizeAddr(raw.sender.toString()) !== normalizeAddr(input.wallet)) throw new Error("Sender mismatch");
  const payload = raw.payload;
  if (!(payload instanceof TransactionPayloadEntryFunction)) throw new Error("Unexpected payload");
  const fn: EntryFunction = payload.entryFunction;
  if (normalizeAddr(fn.module_name.address.toString()) !== normalizeAddr(SHELBY_DEPLOYER) || fn.module_name.name.identifier !== "blob_metadata" || fn.function_name.identifier !== SPONSORED_FUNCTION) {
    throw new Error("Only sponsored Shelby blob registration can be co-signed");
  }
  if (tx.secondarySignerAddresses.length !== 1 || normalizeAddr(tx.secondarySignerAddresses[0].toString()) !== normalizeAddr(getSettlementAccount().accountAddress.toString())) {
    throw new Error("Sponsor mismatch");
  }

  if (!tx.feePayerAddress?.equals(AccountAddress.ZERO)) throw new Error("Fee payer mismatch");

  const aptos = getAptosClient();
  const senderAuthenticator = AccountAuthenticator.deserialize(new Deserializer(hex(input.senderAuthenticator)));
  tx.feePayerAddress = getSettlementAccount().accountAddress;
  const sponsorAuthenticator = aptos.transaction.sign({ signer: getSettlementAccount(), transaction: tx });
  const feePayerAuthenticator = aptos.transaction.signAsFeePayer({ signer: getSettlementAccount(), transaction: tx });
  const pending = await aptos.transaction.submit.multiAgent({ transaction: tx, senderAuthenticator, additionalSignersAuthenticators: [sponsorAuthenticator], feePayerAuthenticator });
  const done = await aptos.waitForTransaction({ transactionHash: pending.hash, options: { checkSuccess: true } });
  const events = "events" in done ? done.events : [];
  const registered = ShelbyBlobClient.registeredBlobUids(events, AccountAddress.from(SHELBY_DEPLOYER));
  const uids = registered.map((e) => ({ objectName: e.objectName, uid: e.uid.toString() }));
  // Quota usage comes from the onchain registration events, not the client.
  await prisma.sponsoredUpload.create({
    data: { userId: input.userId, versionId: input.versionId, bytes: registered.reduce((s, e) => s + e.storedSize, 0), blobCount: uids.length, txHash: pending.hash },
  });
  return { txHash: pending.hash, uids };
}
