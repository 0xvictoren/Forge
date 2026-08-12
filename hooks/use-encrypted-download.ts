"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  deriveOwnerKeyFromWallet,
  downloadBlob,
  fetchAndDecrypt,
  type AuthorizedKeyPackage,
  type WalletSignMessage,
} from "@/lib/encryption";

export type DecryptStatus =
  | "idle"
  | "signing"
  | "fetching"
  | "decrypting"
  | "ready"
  | "error";

/**
 * Client-side decrypt of Shelby ciphertext for authorized users.
 */
export function useEncryptedDownload() {
  const { connected, account, signMessage } = useWallet();
  const ownerKeyRef = useRef<Uint8Array | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<DecryptStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setObjectUrl(null);
  }, []);

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl]);

  const ensureOwnerKey = useCallback(async (): Promise<Uint8Array> => {
    if (ownerKeyRef.current) return ownerKeyRef.current;
    if (!connected || !account || !signMessage) {
      throw new Error("Connect your wallet to decrypt encrypted content");
    }
    setStatus("signing");
    const key = await deriveOwnerKeyFromWallet(
      signMessage as WalletSignMessage
    );
    ownerKeyRef.current = key;
    return key;
  }, [connected, account, signMessage]);

  const decryptFromUrl = useCallback(
    async (opts: {
      ciphertextUrl: string;
      keyPackage: AuthorizedKeyPackage;
      /** Use owner wallet unwrap when possible */
      asOwner?: boolean;
      signal?: AbortSignal;
    }): Promise<{ blob: Blob; mimeType: string; url: string }> => {
      setError(null);
      revokeObjectUrl();

      try {
        let ownerKey: Uint8Array | undefined;
        if (opts.asOwner || opts.keyPackage.wrappedKeyOwner) {
          try {
            ownerKey = await ensureOwnerKey();
          } catch {
            // Share path may still work for buyers
            if (!opts.keyPackage.encryptionShareKey) throw new Error("Wallet signature required");
          }
        }

        setStatus("fetching");
        setStatus("decrypting");

        const { blob, mimeType: mt } = await fetchAndDecrypt({
          ciphertextUrl: opts.ciphertextUrl,
          keyPackage: opts.keyPackage,
          ownerKey,
          preferShare: !opts.asOwner && !!opts.keyPackage.encryptionShareKey,
          signal: opts.signal,
        });

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setObjectUrl(url);
        setMimeType(mt);
        setStatus("ready");
        return { blob, mimeType: mt, url };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Decryption failed";
        setError(msg);
        setStatus("error");
        throw e;
      }
    },
    [ensureOwnerKey, revokeObjectUrl]
  );

  const decryptAndDownload = useCallback(
    async (opts: {
      ciphertextUrl: string;
      keyPackage: AuthorizedKeyPackage;
      fileName?: string;
      asOwner?: boolean;
    }) => {
      const { blob, mimeType: mt } = await decryptFromUrl(opts);
      const name =
        opts.fileName ||
        opts.keyPackage.fileName ||
        `download${mt.includes("png") ? ".png" : ""}`;
      downloadBlob(blob, name);
      return blob;
    },
    [decryptFromUrl]
  );

  return {
    decryptFromUrl,
    decryptAndDownload,
    revokeObjectUrl,
    status,
    error,
    objectUrl,
    mimeType,
    isBusy: status === "signing" || status === "fetching" || status === "decrypting",
    canDecrypt: connected && !!account && !!signMessage,
  };
}
