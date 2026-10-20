import "server-only";
import { AccountAddress, AccountAuthenticator, Deserializer, SimpleTransaction, TransactionPayloadEntryFunction } from "@aptos-labs/ts-sdk";
import { SHELBY_DEPLOYER } from "@shelby-protocol/sdk/node";
import { prisma } from "@/lib/db";
import { getAptosClient } from "@/lib/aptos";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { getSettlementAccount } from "@/lib/agents/channels";
import { MICROPAYMENTS_MODULE, normalizeAddr } from "@/lib/agents/config";

/**
 * Gas sponsorship for email (Privy) accounts: Forge is the fee payer, so these
 * users never need APT for gas. Only Forge's own contract, Shelby storage and
 * Shelby micropayment channels are sponsored, with per-transaction gas caps
 * and a daily count per user. Payments inside a transaction (a licence price,
 * a channel deposit) still come from the user's own balance.
 */

export const GAS_DAILY_TX = Number(process.env.FORGE_GAS_DAILY_TX || 60);
const MAX_GAS_AMOUNT = BigInt(200_000);
const MAX_GAS_UNIT_PRICE = BigInt(200);

const allowedModules = () => new Set([CONTRACT_ADDRESS, SHELBY_DEPLOYER, MICROPAYMENTS_MODULE].filter(Boolean).map((a) => normalizeAddr(a)));

const fromHex = (s: string) => new Deserializer(Buffer.from(s.replace(/^0x/, ""), "hex"));

export async function sponsorGas(input: { userId: string; wallet: string; transaction: string; senderAuthenticator: string }) {
  const tx = SimpleTransaction.deserialize(fromHex(input.transaction));
  const raw = tx.rawTransaction;
  const settlement = getSettlementAccount();

  if (normalizeAddr(raw.sender.toString()) !== normalizeAddr(input.wallet)) throw new Error("This transaction is not from your account");
  // The sender signs with the 0x0 fee payer placeholder; Forge fills in its address below.
  if (!tx.feePayerAddress || !tx.feePayerAddress.equals(AccountAddress.ZERO)) throw new Error("Build the transaction with a fee payer");
  if (raw.max_gas_amount > MAX_GAS_AMOUNT || raw.gas_unit_price > MAX_GAS_UNIT_PRICE) throw new Error("Gas limits are too high to sponsor");

  const payload = raw.payload;
  if (!(payload instanceof TransactionPayloadEntryFunction)) throw new Error("Only contract calls can be sponsored");
  const fn = payload.entryFunction;
  const moduleAddr = normalizeAddr(fn.module_name.address.toString());
  if (!allowedModules().has(moduleAddr)) throw new Error("Forge only pays gas for Forge and Shelby transactions");
  const fnName = `${fn.module_name.name.identifier}::${fn.function_name.identifier}`;

  const used = await prisma.sponsoredGas.count({ where: { userId: input.userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (used >= GAS_DAILY_TX) throw new Error("You've reached today's limit of free transactions. Try again tomorrow.");

  const aptos = getAptosClient();
  tx.feePayerAddress = settlement.accountAddress;
  const senderAuthenticator = AccountAuthenticator.deserialize(fromHex(input.senderAuthenticator));
  const feePayerAuthenticator = aptos.transaction.signAsFeePayer({ signer: settlement, transaction: tx });
  const pending = await aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator, feePayerAuthenticator });
  await prisma.sponsoredGas.create({ data: { userId: input.userId, txHash: pending.hash, function: `${moduleAddr}::${fnName}` } });
  return { hash: pending.hash };
}
