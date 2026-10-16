import "server-only";
import { MoveVector, type Account, type InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
import { prisma } from "@/lib/db";
import { getAptosClient } from "@/lib/aptos";
import { PLATFORM_ADDRESS, PLATFORM_FEE_BPS } from "@/lib/constants";
import { createNotification } from "@/lib/notifications";
import { AGENT_PAYMENT_ASSET, CHANNEL_SETTLE_BEFORE_EXPIRY_MS, MICROPAYMENTS_MODULE, normalizeAddr } from "./config";
import { decodeMicropayment, fetchOnchainChannel, getSettlementAccount } from "./channels";
import { octasToAptString } from "./pricing";

/** On MongoDB an unset field does not match `null`, so match both. */
const UNPAID = { OR: [{ payoutId: null }, { payoutId: { isSet: false } }] };

/** Withdraw a channel once unsettled reads are worth at least this much. */
const MIN_WITHDRAW_OCTAS = BigInt(process.env.AGENT_MIN_WITHDRAW_OCTAS || "100000"); // 0.001 APT
/** Pay a seller once their funded earnings reach this much. */
const MIN_PAYOUT_OCTAS = BigInt(process.env.AGENT_MIN_PAYOUT_OCTAS || "100000");

async function submit(signer: Account, data: InputGenerateTransactionPayloadData) {
  const aptos = getAptosClient();
  const tx = await aptos.transaction.build.simple({ sender: signer.accountAddress, data, options: { maxGasAmount: 50_000, gasUnitPrice: 100 } });
  const pending = await aptos.signAndSubmitTransaction({ signer, transaction: tx });
  await aptos.waitForTransaction({ transactionHash: pending.hash, options: { checkSuccess: true, timeoutSecs: 60 } });
  return pending.hash;
}

function transferPayload(to: string, amount: bigint): InputGenerateTransactionPayloadData {
  // APT moves with aptos_account::transfer; any other fungible asset by metadata.
  if (normalizeAddr(AGENT_PAYMENT_ASSET) === normalizeAddr("0xa")) {
    return { function: "0x1::aptos_account::transfer", functionArguments: [to, amount.toString()] };
  }
  return { function: "0x1::primary_fungible_store::transfer", typeArguments: ["0x1::fungible_asset::Metadata"], functionArguments: [AGENT_PAYMENT_ASSET, to, amount.toString()] };
}

/**
 * Step 1: pull accepted-but-unwithdrawn funds out of agent channels into the
 * settlement account using the latest signed micropayment.
 */
export async function withdrawChannels(opts?: { channelIds?: string[]; force?: boolean }) {
  const signer = getSettlementAccount();
  const channels = await prisma.agentChannel.findMany({
    where: { lastMicropayment: { not: null }, ...(opts?.channelIds ? { id: { in: opts.channelIds } } : {}) },
  });
  const results: { channelId: string; amount: string; txHash?: string; error?: string }[] = [];
  for (const ch of channels) {
    const pending = BigInt(ch.acceptedAmount) - BigInt(ch.withdrawnAmount);
    if (pending <= BigInt(0)) continue;
    const expiringSoon = ch.expiresAt.getTime() < Date.now() + CHANNEL_SETTLE_BEFORE_EXPIRY_MS;
    if (!opts?.force && !expiringSoon && pending < MIN_WITHDRAW_OCTAS) continue;
    try {
      const mp = decodeMicropayment(ch.lastMicropayment!);
      const onchain = await fetchOnchainChannel(ch.sender);
      if (!onchain || onchain.channelId !== ch.channelId) throw new Error("Channel no longer exists onchain");
      if (mp.sequenceNumber < onchain.nextSequence) {
        // Already withdrawn (e.g. a previous run crashed after submitting): just sync.
        await prisma.agentChannel.update({ where: { id: ch.id }, data: { withdrawnAmount: onchain.withdrawn.toString(), withdrawnSequence: (onchain.nextSequence - BigInt(1)).toString() } });
      } else {
        const txHash = await submit(signer, {
          function: `${MICROPAYMENTS_MODULE}::micropayments::receiver_withdraw`,
          functionArguments: [ch.sender, AGENT_PAYMENT_ASSET, mp.amount.toString(), ch.channelId, mp.sequenceNumber.toString(), MoveVector.U8(mp.signature)],
        });
        await prisma.channelWithdrawal.create({ data: { channelId: ch.id, amount: (mp.amount - BigInt(ch.withdrawnAmount)).toString(), sequence: mp.sequenceNumber.toString(), txHash } });
        await prisma.agentChannel.update({ where: { id: ch.id }, data: { withdrawnAmount: mp.amount.toString(), withdrawnSequence: mp.sequenceNumber.toString() } });
        results.push({ channelId: ch.id, amount: pending.toString(), txHash });
      }
      // Every read at or below the withdrawn sequence is now backed by real funds.
      const fresh = await prisma.agentChannel.findUniqueOrThrow({ where: { id: ch.id } });
      const reads = await prisma.agentRead.findMany({ where: { channelId: ch.id, funded: false }, select: { id: true, sequence: true } });
      const fundedIds = reads.filter((r) => BigInt(r.sequence) <= BigInt(fresh.withdrawnSequence)).map((r) => r.id);
      if (fundedIds.length) await prisma.agentRead.updateMany({ where: { id: { in: fundedIds } }, data: { funded: true } });
    } catch (e) {
      results.push({ channelId: ch.id, amount: pending.toString(), error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

/**
 * Step 2: pay each seller their funded earnings minus the platform fee, and
 * move the fee to the treasury. Reads are claimed by a PENDING payout before
 * any transfer, so a crash can never pay the same read twice.
 */
export async function payoutSellers(opts?: { sellerId?: string; force?: boolean }) {
  const signer = getSettlementAccount();
  const sellers = await prisma.agentRead.groupBy({
    by: ["sellerId"],
    where: { funded: true, ...UNPAID, ...(opts?.sellerId ? { sellerId: opts.sellerId } : {}) },
  });
  const results: { sellerId: string; net?: string; txHash?: string; error?: string }[] = [];
  for (const { sellerId } of sellers) {
    const reads = await prisma.agentRead.findMany({ where: { sellerId, funded: true, ...UNPAID }, select: { id: true, priceOctas: true } });
    const gross = reads.reduce((s, r) => s + BigInt(r.priceOctas), BigInt(0));
    if (!opts?.force && gross < MIN_PAYOUT_OCTAS) continue;
    const fee = (gross * BigInt(PLATFORM_FEE_BPS)) / BigInt(10_000);
    const net = gross - fee;
    const seller = await prisma.user.findUnique({ where: { id: sellerId } });
    const wallet = seller?.walletAddress || seller?.address;
    if (!wallet) {
      results.push({ sellerId, error: "Seller has no wallet" });
      continue;
    }
    const payout = await prisma.sellerPayout.create({
      data: { sellerId, grossOctas: gross.toString(), feeOctas: fee.toString(), netOctas: net.toString(), readCount: reads.length, asset: AGENT_PAYMENT_ASSET },
    });
    const claimed = await prisma.agentRead.updateMany({ where: { id: { in: reads.map((r) => r.id) }, ...UNPAID }, data: { payoutId: payout.id } });
    if (claimed.count !== reads.length) {
      await prisma.agentRead.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } });
      await prisma.sellerPayout.update({ where: { id: payout.id }, data: { status: "FAILED", error: "Concurrent payout run" } });
      continue;
    }
    try {
      const txHash = await submit(signer, transferPayload(wallet, net));
      let feeTxHash: string | null = null;
      if (fee > BigInt(0) && PLATFORM_ADDRESS && normalizeAddr(PLATFORM_ADDRESS) !== normalizeAddr(signer.accountAddress.toString())) {
        feeTxHash = await submit(signer, transferPayload(PLATFORM_ADDRESS, fee)).catch(() => null);
      }
      await prisma.sellerPayout.update({ where: { id: payout.id }, data: { status: "PAID", txHash, feeTxHash } });
      await createNotification({
        userId: sellerId,
        type: "PAYOUT",
        title: "Agent earnings paid",
        body: `${octasToAptString(net)} APT for ${reads.length} paid read${reads.length === 1 ? "" : "s"}`,
        href: "/studio",
      }).catch(() => undefined);
      results.push({ sellerId, net: net.toString(), txHash });
    } catch (e) {
      // Release the reads so the next run retries them.
      await prisma.agentRead.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } });
      const error = e instanceof Error ? e.message : String(e);
      await prisma.sellerPayout.update({ where: { id: payout.id }, data: { status: "FAILED", error } });
      results.push({ sellerId, error });
    }
  }
  return results;
}

export async function runSettlement(opts?: { sellerId?: string; force?: boolean }) {
  let channelIds: string[] | undefined;
  if (opts?.sellerId) {
    const rows = await prisma.agentRead.findMany({ where: { sellerId: opts.sellerId, funded: false }, select: { channelId: true }, distinct: ["channelId"] });
    channelIds = rows.map((r) => r.channelId);
  }
  const withdrawals = await withdrawChannels({ channelIds, force: opts?.force });
  const payouts = await payoutSellers(opts);
  return { withdrawals, payouts };
}
