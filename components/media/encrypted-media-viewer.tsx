"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { useEncryptedDownload } from "@/hooks/use-encrypted-download";
import type { AuthorizedKeyPackage } from "@/lib/encryption";
import { EncryptedBadge } from "@/components/ui/encrypted-badge";
import { downloadBlob } from "@/lib/encryption";

type Props = {
  streamUrl: string;
  keyPackage: AuthorizedKeyPackage;
  fileName?: string;
  mimeType?: string;
  disableDownload?: boolean;
  asOwner?: boolean;
  title?: string;
};

/**
 * Fetches ciphertext, decrypts in-browser, and renders image/video or download.
 */
export function EncryptedMediaViewer({
  streamUrl,
  keyPackage,
  fileName,
  mimeType: mimeHint,
  disableDownload,
  asOwner,
  title,
}: Props) {
  const { connected } = useWallet();
  const { decryptFromUrl, isBusy, status, error, objectUrl, mimeType } =
    useEncryptedDownload();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!connected || !streamUrl || !keyPackage?.isEncrypted || started) return;
    setStarted(true);
    decryptFromUrl({
      ciphertextUrl: streamUrl,
      keyPackage,
      asOwner,
    })
      .then((r) => setBlob(r.blob))
      .catch(() => {});
  }, [connected, streamUrl, keyPackage, asOwner, decryptFromUrl, started]);

  const mt = mimeType || mimeHint || keyPackage.mimeType || "";
  const name = fileName || keyPackage.fileName || title || "download";

  if (!connected) {
    return (
      <div className="rounded-2xl border border-[var(--border-dim)] bg-[var(--bg-subtle)] p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Connect your wallet to decrypt this encrypted file.
        </p>
        <ConnectWallet className="justify-center" />
      </div>
    );
  }

  if (isBusy || (!objectUrl && !error)) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-black/5">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          {status === "signing"
            ? "Sign the key-derivation message in your wallet…"
            : status === "fetching"
              ? "Fetching encrypted blob from Shelby…"
              : "Decrypting with AES-256-GCM…"}
        </p>
        <EncryptedBadge size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="font-medium text-red-600">{error}</p>
        <button
          type="button"
          className="btn-accent-ghost mt-4 text-sm"
          onClick={() => {
            setStarted(false);
            setBlob(null);
          }}
        >
          Retry decrypt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <EncryptedBadge size="sm" label="Decrypted locally" />
      </div>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-black">
        {mt.startsWith("image/") && objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objectUrl}
            alt={title || name}
            className="max-h-[500px] w-auto object-contain"
          />
        ) : mt.startsWith("video/") && objectUrl ? (
          <video src={objectUrl} controls className="max-h-[500px] w-full" />
        ) : mt.startsWith("audio/") && objectUrl ? (
          <audio src={objectUrl} controls className="w-full px-6" />
        ) : (
          <div className="py-12 text-center text-gray-400">
            <p className="mb-2">File decrypted in your browser</p>
            <p className="text-sm">{name}</p>
          </div>
        )}
      </div>
      {!disableDownload && blob && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 font-semibold text-white"
          onClick={() => downloadBlob(blob, name)}
        >
          Download decrypted file
        </button>
      )}
    </div>
  );
}
