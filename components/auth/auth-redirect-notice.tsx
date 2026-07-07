"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, X } from "lucide-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { messageForReturnPath, normalizeReturnPath } from "@/lib/auth-redirect";
import { AUTH_RETURN_KEY } from "@/lib/nav-config";
import { toast } from "sonner";

export function AuthRedirectNotice() {
  const searchParams = useSearchParams();
  const returnPath = normalizeReturnPath(searchParams.get("return"));
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!returnPath) return;
    sessionStorage.setItem(AUTH_RETURN_KEY, returnPath);
    toast.info(messageForReturnPath(returnPath), { duration: 6000 });
  }, [returnPath]);

  if (!returnPath || dismissed) return null;

  const message = messageForReturnPath(returnPath);
  const destination = returnPath.replace(/^\//, "").split("/")[0] || "this page";

  return (
    <div className="border-b border-[var(--brand)]/30 bg-[var(--accent-dim)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-12">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <Wallet className="h-4 w-4 text-[var(--brand)]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">
              Wallet required for {destination}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{message}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              After connecting, you&apos;ll be taken back automatically.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          <ConnectWallet className="!py-2.5" />
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="btn-ghost !px-2"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}