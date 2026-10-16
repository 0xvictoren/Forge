import "server-only";
import { Account, Ed25519PrivateKey, Ed25519PublicKey, Ed25519Signature, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { SenderBuiltMicropayment } from "@shelby-protocol/sdk/node";
import type { AgentChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAptosClient } from "@/lib/aptos";
import { findOrCreateWalletUser } from "@/lib/find-or-create-user";
import { AGENT_PAYMENT_ASSET, CHANNEL_SAFETY_MARGIN_MS, MICROPAYMENTS_MODULE, normalizeAddr } from "./config";

let settlementAccount: Account | null = null;

/**
 * The account every agent channel pays into. It signs receiver_withdraw and
 * seller payouts, so its key must stay server-side.
 */
export function getSettlementAccount(): Account {
  if (settlementAccount) return settlementAccount;
  const raw = process.env.FORGE_SETTLEMENT_PRIVATE_KEY || process.env.SHELBY_SIGNER_PRIVATE_KEY;
  if (!raw) throw new Error("FORGE_SETTLEMENT_PRIVATE_KEY is not configured");
  settlementAccount = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(raw.trim().replace(/^ed25519-priv-/, ""), PrivateKeyVariants.Ed25519)),
  });
  return settlementAccount;
}

export function settlementAddress(): string {
  return normalizeAddr(getSettlementAccount().accountAddress.toString());
}

export type OnchainChannel = {
  channelId: string;
  balance: bigint;
  withdrawn: bigint;
  capacity: bigint;
  expiresAtMs: number;
  nextSequence: bigint;
  publicKey: string;
};

type RawChannelInfo = {
  payment_channel_id: string;
  balance: string;
  receiver_withdrawn_amount: string;
  expiration_micros: string;
  next_withdrawn_sequence_number: string;
  public_key: string;
  asset_metadata: { inner: string };
};

/** Read the agent's channel to Forge for our payment asset straight from the chain. */
export async function fetchOnchainChannel(sender: string): Promise<OnchainChannel | null> {
  const receiver = settlementAddress();
  const [infos] = await getAptosClient().view<[RawChannelInfo[]]>({
    payload: {
      function: `${MICROPAYMENTS_MODULE}::micropayments::get_all_channels_from_sender_to_receiver`,
      functionArguments: [normalizeAddr(sender), receiver],
    },
  });
  const asset = normalizeAddr(AGENT_PAYMENT_ASSET);
  const info = (infos || []).find((c) => normalizeAddr(c.asset_metadata.inner) === asset);
  if (!info) return null;
  const balance = BigInt(info.balance);
  const withdrawn = BigInt(info.receiver_withdrawn_amount);
  return {
    channelId: String(info.payment_channel_id),
    balance,
    withdrawn,
    capacity: balance + withdrawn,
    expiresAtMs: Number(BigInt(info.expiration_micros) / BigInt(1000)),
    nextSequence: BigInt(info.next_withdrawn_sequence_number),
    publicKey: info.public_key.toLowerCase(),
  };
}

/** Create or refresh Forge's record of an agent's channel from chain state. */
export async function syncChannel(sender: string): Promise<AgentChannel | null> {
  const onchain = await fetchOnchainChannel(sender);
  if (!onchain) return null;
  const s = normalizeAddr(sender);
  const receiver = settlementAddress();
  const asset = normalizeAddr(AGENT_PAYMENT_ASSET);
  const user = await findOrCreateWalletUser(s);
  const existing = await prisma.agentChannel.findUnique({
    where: { sender_receiver_asset_channelId: { sender: s, receiver, asset, channelId: onchain.channelId } },
  });
  const data = {
    capacity: onchain.capacity.toString(),
    expiresAt: new Date(onchain.expiresAtMs),
    publicKey: onchain.publicKey,
    refreshedAt: new Date(),
  };
  if (existing) return prisma.agentChannel.update({ where: { id: existing.id }, data });
  return prisma.agentChannel.create({
    data: {
      ...data,
      userId: user.id,
      sender: s,
      receiver,
      asset,
      channelId: onchain.channelId,
      // Sequence numbers below the chain's next withdrawn sequence can never settle.
      lastSequence: (onchain.nextSequence - BigInt(1)).toString(),
      acceptedAmount: onchain.withdrawn.toString(),
      withdrawnAmount: onchain.withdrawn.toString(),
      withdrawnSequence: (onchain.nextSequence - BigInt(1)).toString(),
    },
  });
}

export function decodeMicropayment(headerValue: string): SenderBuiltMicropayment {
  const bin = Buffer.from(headerValue.trim(), "base64");
  if (!bin.length) throw new Error("Empty micropayment header");
  return SenderBuiltMicropayment.deserialize(new Uint8Array(bin));
}

export function encodeMicropayment(mp: SenderBuiltMicropayment): string {
  return Buffer.from(mp.bcsToBytes()).toString("base64");
}

export type PaymentCheck =
  | { ok: true; channel: AgentChannel; amount: bigint; sequence: bigint; encoded: string }
  | { ok: false; status: 402 | 409 | 400; error: string; channel?: AgentChannel | null };

/**
 * Validate a micropayment for a read costing `priceOctas`, without committing
 * it. Checks: addressed to Forge, right asset and module, signed by the
 * channel's registered key, covers the price on top of what was already
 * accepted, fits in the channel, and the channel stays open long enough.
 */
export async function checkMicropayment(headerValue: string, priceOctas: bigint): Promise<PaymentCheck> {
  let mp: SenderBuiltMicropayment;
  try {
    mp = decodeMicropayment(headerValue);
  } catch {
    return { ok: false, status: 400, error: "Malformed micropayment header" };
  }
  const sender = normalizeAddr(mp.sender.toString());
  if (normalizeAddr(mp.receiver.toString()) !== settlementAddress()) return { ok: false, status: 400, error: "Micropayment is not addressed to Forge" };
  if (normalizeAddr(mp.fungibleAssetAddress.toString()) !== normalizeAddr(AGENT_PAYMENT_ASSET)) return { ok: false, status: 400, error: "Unsupported payment asset" };
  if (normalizeAddr(mp.deployer.toString()) !== normalizeAddr(MICROPAYMENTS_MODULE)) return { ok: false, status: 400, error: "Unknown micropayments module" };

  let channel = await prisma.agentChannel.findFirst({
    where: { sender, receiver: settlementAddress(), asset: normalizeAddr(AGENT_PAYMENT_ASSET), channelId: mp.paymentChannelId.toString() },
  });
  const stale = !channel || Date.now() - channel.refreshedAt.getTime() > 60_000 || BigInt(channel.capacity) < mp.amount;
  if (stale) channel = await syncChannel(sender);
  if (!channel || channel.channelId !== mp.paymentChannelId.toString()) {
    return { ok: false, status: 402, error: "No open payment channel from this agent to Forge", channel };
  }

  const pub = Buffer.from(mp.publicKey).toString("hex");
  if (`0x${pub}` !== channel.publicKey.toLowerCase()) return { ok: false, status: 400, error: "Signed with a key that is not registered on the channel" };
  const valid = new Ed25519PublicKey(mp.publicKey).verifySignature({
    message: mp.getSignedMessage(),
    signature: new Ed25519Signature(mp.signature),
  });
  if (!valid) return { ok: false, status: 400, error: "Invalid micropayment signature" };

  if (channel.expiresAt.getTime() < Date.now() + CHANNEL_SAFETY_MARGIN_MS) {
    return { ok: false, status: 402, error: "Payment channel expires too soon. Extend it, then retry.", channel };
  }
  const accepted = BigInt(channel.acceptedAmount);
  const lastSeq = BigInt(channel.lastSequence);
  if (mp.sequenceNumber <= lastSeq || mp.amount < accepted) {
    return { ok: false, status: 409, error: "Stale micropayment: sign on top of the latest accepted state", channel };
  }
  if (mp.amount - accepted < priceOctas) {
    return { ok: false, status: 402, error: `Micropayment too small: needs ${priceOctas} more octas on top of ${accepted}`, channel };
  }
  if (mp.amount > BigInt(channel.capacity)) {
    return { ok: false, status: 402, error: "Payment channel balance is too low. Top it up, then retry.", channel };
  }
  return { ok: true, channel, amount: mp.amount, sequence: mp.sequenceNumber, encoded: encodeMicropayment(mp) };
}

/**
 * Atomically record a checked micropayment. Compare-and-swap on the previous
 * accepted state means two concurrent reads can never both spend the same
 * increment; the loser gets a 409 and re-signs.
 */
export async function commitMicropayment(check: Extract<PaymentCheck, { ok: true }>) {
  const res = await prisma.agentChannel.updateMany({
    where: { id: check.channel.id, acceptedAmount: check.channel.acceptedAmount, lastSequence: check.channel.lastSequence },
    data: { acceptedAmount: check.amount.toString(), lastSequence: check.sequence.toString(), lastMicropayment: check.encoded },
  });
  return res.count === 1;
}

/** What a client needs to sign its next micropayment. */
export function channelState(channel: AgentChannel | null) {
  if (!channel) return null;
  return {
    channelId: channel.channelId,
    acceptedAmount: channel.acceptedAmount,
    nextSequenceNumber: (BigInt(channel.lastSequence) + BigInt(1)).toString(),
    capacity: channel.capacity,
    available: (BigInt(channel.capacity) - BigInt(channel.acceptedAmount)).toString(),
    expiresAt: channel.expiresAt.toISOString(),
    lastMicropayment: channel.lastMicropayment,
  };
}

