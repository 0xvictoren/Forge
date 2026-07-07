/** Map raw Shelby / Aptos errors to user-friendly upload messages. */
export function formatShelbyUploadError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("insufficient_balance_for_transaction_fee") ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient_balance")
  ) {
    return "Insufficient APT in your connected wallet. Add a small amount of APT and approve the Shelby registration transaction.";
  }
  if (lower.includes("shelby_signer_private_key") || lower.includes("not configured")) {
    return "Connect your wallet to upload — your wallet pays the Shelby registration fee.";
  }
  if (lower.includes("user rejected") || lower.includes("rejected the")) {
    return "Transaction cancelled in wallet.";
  }
  return message.length > 280 ? `${message.slice(0, 280)}…` : message;
}