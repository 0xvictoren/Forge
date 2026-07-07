export function getExplorerUrl(txHash: string): string {
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=shelbynet`;
}
