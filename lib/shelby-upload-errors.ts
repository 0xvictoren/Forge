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
  if (
    lower.includes("e_no_location_selected") ||
    lower.includes("no location") ||
    lower.includes("locationhint")
  ) {
    return "Shelby registration needs a storage location. Refresh and try again.";
  }
  if (
    lower.includes("field 'blob_name'") ||
    lower.includes('field "blob_name"') ||
    lower.includes("field 'blobs'") ||
    (lower.includes("cannot query field") && lower.includes("blobs"))
  ) {
    return "Shelby indexer schema changed. Update @shelby-protocol/sdk and retry.";
  }
  return message.length > 280 ? `${message.slice(0, 280)}…` : message;
}