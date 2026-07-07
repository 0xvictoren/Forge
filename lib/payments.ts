import { AccountAddress } from "@aptos-labs/ts-sdk";
import { getAptosClient } from "./aptos";

export function aptToOctas(apt: number): bigint {
  return BigInt(Math.round(apt * 1e8));
}

export function octasToApt(octas: bigint | number): number {
  return Number(octas) / 1e8;
}

export function normalizeAddress(address: string): string {
  return AccountAddress.fromString(address).toString();
}

export function calcFee(amountApt: number, feeBps: number) {
  const feeApt = (amountApt * feeBps) / 10000;
  const netApt = amountApt - feeApt;
  return { feeApt, netApt };
}

/** Build payload for 0x1::aptos_account::transfer */
export function buildTransferPayload(recipient: string, amountApt: number) {
  return {
    function: "0x1::aptos_account::transfer" as const,
    typeArguments: [] as string[],
    functionArguments: [recipient, aptToOctas(amountApt).toString()],
  };
}

type TransferDetails = {
  recipient: string;
  amount: bigint;
};

function extractTransfer(
  tx: Record<string, unknown>,
  expectedRecipient?: string
): TransferDetails | null {
  const payload = tx.payload as
    | {
        type?: string;
        function?: string;
        arguments?: unknown[];
      }
    | undefined;

  if (
    payload?.type === "entry_function_payload" &&
    payload.function?.includes("transfer") &&
    Array.isArray(payload.arguments) &&
    payload.arguments.length >= 2
  ) {
    const recipient = String(payload.arguments[0]);
    const amount = BigInt(String(payload.arguments[1]));
    if (!expectedRecipient) return { recipient, amount };
    try {
      if (normalizeAddress(recipient) === normalizeAddress(expectedRecipient)) {
        return { recipient, amount };
      }
    } catch {
      /* try events */
    }
  }

  const events =
    (tx.events as Array<{ type?: string; data?: Record<string, unknown> }>) || [];

  for (const event of events) {
    const type = event.type || "";
    if (!type.includes("Deposit") && !type.includes("FungibleStore")) continue;

    const amount = event.data?.amount ?? event.data?.value;
    if (amount == null) continue;

    const recipient =
      event.data?.store ??
      event.data?.account ??
      event.data?.to ??
      event.data?.recipient;

    if (!recipient) continue;

    const recipientStr = String(recipient);
    if (expectedRecipient) {
      try {
        if (normalizeAddress(recipientStr) !== normalizeAddress(expectedRecipient)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    return {
      recipient: recipientStr,
      amount: BigInt(String(amount)),
    };
  }

  return null;
}

export async function verifyAptPayment(
  txHash: string,
  options: {
    sender?: string;
    recipient?: string;
    minAmountApt?: number;
  }
): Promise<{ valid: boolean; error?: string }> {
  if (!txHash?.startsWith("0x")) {
    return { valid: false, error: "Invalid transaction hash" };
  }

  const maxAttempts = 8;
  let lastError = "Verification failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const aptos = getAptosClient();
      await aptos.waitForTransaction({
        transactionHash: txHash,
        options: { checkSuccess: true, timeoutSecs: 60 },
      });

      const tx = (await aptos.getTransactionByHash({
        transactionHash: txHash,
      })) as Record<string, unknown>;

      if ("success" in tx && tx.success === false) {
        return { valid: false, error: "Transaction failed on-chain" };
      }

      if (options.sender && "sender" in tx && tx.sender) {
        if (
          normalizeAddress(String(tx.sender)) !== normalizeAddress(options.sender)
        ) {
          return { valid: false, error: "Sender mismatch" };
        }
      }

      if (options.recipient || options.minAmountApt != null) {
        const transfer = extractTransfer(tx, options.recipient);
        if (!transfer) {
          return { valid: false, error: "No APT transfer found in transaction" };
        }

        if (options.recipient) {
          try {
            if (
              normalizeAddress(transfer.recipient) !==
              normalizeAddress(options.recipient)
            ) {
              return { valid: false, error: "Recipient mismatch" };
            }
          } catch {
            return { valid: false, error: "Invalid recipient in transaction" };
          }
        }

        if (options.minAmountApt != null) {
          const minOctas = aptToOctas(options.minAmountApt);
          if (transfer.amount < minOctas) {
            return {
              valid: false,
              error: `Insufficient amount: got ${octasToApt(transfer.amount)} APT, expected at least ${options.minAmountApt} APT`,
            };
          }
        }
      }

      return { valid: true };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Verification failed";
      const retryable =
        lastError.toLowerCase().includes("not found") ||
        lastError.toLowerCase().includes("pending") ||
        lastError.toLowerCase().includes("timeout");
      if (retryable && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
    }
  }

  return { valid: false, error: lastError };
}
