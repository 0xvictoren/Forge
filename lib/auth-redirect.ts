/** Friendly copy when middleware sends users to /?return=... */

export const AUTH_RETURN_MESSAGES: Record<string, string> = {
  "/upload": "Connect your wallet to access Upload and publish assets to Shelby.",
  "/library": "Please connect your wallet to view your Library and downloads.",
  "/wallet": "Connect your wallet to view earnings, payouts, and transactions.",
  "/chat": "Connect wallet to continue to Messages.",
  "/home": "Connect your wallet to access your creator home.",
  "/dashboard": "Connect your wallet to open your Creator Dashboard.",
  "/vaults": "Connect your wallet to manage your Vaults.",
  "/profile": "Connect your wallet to edit your profile.",
  "/workspaces": "Connect your wallet to access Workspaces.",
  "/onboarding": "Connect your wallet to complete onboarding.",
  "/bundles": "Connect your wallet to manage Bundles.",
  "/stream": "Connect your wallet to manage Streams.",
};

export function messageForReturnPath(returnPath: string | null | undefined): string {
  if (!returnPath || returnPath === "/") {
    return "Connect your wallet to continue.";
  }

  const base = returnPath.split("?")[0];
  if (AUTH_RETURN_MESSAGES[base]) return AUTH_RETURN_MESSAGES[base];

  if (base.startsWith("/chat/")) return AUTH_RETURN_MESSAGES["/chat"];
  if (base.startsWith("/vaults/")) return AUTH_RETURN_MESSAGES["/vaults"];
  if (base.startsWith("/wallet/")) return AUTH_RETURN_MESSAGES["/wallet"];

  return `Connect your wallet to access ${base}.`;
}

export function normalizeReturnPath(path: string | null | undefined): string | null {
  if (!path || path === "/") return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path.split("?")[0];
}