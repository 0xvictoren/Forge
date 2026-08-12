"use client";

import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useEncryptedDownload } from "@/hooks/use-encrypted-download";
import type { AuthorizedKeyPackage } from "@/lib/encryption";
import { EncryptedBadge } from "@/components/ui/encrypted-badge";

type Props = {
  /** Unencrypted direct download href (used when isEncrypted is false) */
  downloadUrl?: string | null;
  fileName?: string;
  isEncrypted?: boolean;
  /**
   * Endpoint that returns { streamUrl, encryption } after auth.
   * e.g. /api/assets/{id}/decrypt-package
   */
  keyPackageUrl?: string;
  asOwner?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Download button that decrypts client-side when content is encrypted.
 */
export function EncryptedDownloadButton({
  downloadUrl,
  fileName,
  isEncrypted = false,
  keyPackageUrl,
  asOwner = false,
  className = "btn-primary flex w-full items-center justify-center gap-2 py-4 text-base",
  children,
}: Props) {
  const { decryptAndDownload, isBusy, status } = useEncryptedDownload();
  const [localBusy, setLocalBusy] = useState(false);

  const busy = isBusy || localBusy;

  const handleClick = async () => {
    if (!isEncrypted) {
      if (!downloadUrl) {
        toast.error("Download unavailable");
        return;
      }
      // Plain download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName || "download";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    if (!keyPackageUrl) {
      toast.error("Missing decryption package endpoint");
      return;
    }

    setLocalBusy(true);
    try {
      const res = await fetch(keyPackageUrl);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not authorized to decrypt");

      const encryption = data.encryption as AuthorizedKeyPackage | undefined;
      const streamUrl = data.streamUrl as string | undefined;
      if (!encryption?.isEncrypted || !streamUrl) {
        throw new Error("Server did not return encryption material");
      }

      await decryptAndDownload({
        ciphertextUrl: streamUrl,
        keyPackage: {
          ...encryption,
          fileName: encryption.fileName || fileName || data.fileName,
        },
        fileName: fileName || data.fileName || "download",
        asOwner,
      });
      toast.success("Decrypted and downloading…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Decrypt failed");
    } finally {
      setLocalBusy(false);
    }
  };

  const label = busy
    ? status === "signing"
      ? "Sign to unlock key…"
      : status === "fetching"
        ? "Fetching ciphertext…"
        : "Decrypting…"
    : children ??
      (isEncrypted ? "Decrypt & download" : "Download file");

  return (
    <div className="space-y-2">
      {isEncrypted && (
        <div className="flex justify-center">
          <EncryptedBadge size="sm" />
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || (!isEncrypted && !downloadUrl)}
        className={className}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isEncrypted ? (
          <Lock className="h-5 w-5" />
        ) : (
          <Download className="h-5 w-5" />
        )}
        {label}
      </button>
    </div>
  );
}
