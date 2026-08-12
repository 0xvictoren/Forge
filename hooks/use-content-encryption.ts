"use client";

import { useCallback, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  deriveOwnerKeyFromWallet,
  encryptFile,
  type EncryptionMaterial,
  type EncryptFileResult,
  type WalletSignMessage,
} from "@/lib/encryption";

/**
 * Wallet-bound content encryption for upload flows.
 * Caches the derived owner key for the session after the first signMessage.
 */
export function useContentEncryption() {
  const { connected, account, signMessage } = useWallet();
  const ownerKeyRef = useRef<Uint8Array | null>(null);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearCachedKey = useCallback(() => {
    ownerKeyRef.current = null;
  }, []);

  const ensureOwnerKey = useCallback(async (): Promise<Uint8Array> => {
    if (ownerKeyRef.current) return ownerKeyRef.current;
    if (!connected || !account) {
      throw new Error("Connect your wallet to encrypt content");
    }
    if (!signMessage) {
      throw new Error("This wallet cannot sign messages required for encryption");
    }

    setIsDerivingKey(true);
    setError(null);
    try {
      const key = await deriveOwnerKeyFromWallet(
        signMessage as WalletSignMessage
      );
      ownerKeyRef.current = key;
      return key;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to derive encryption key";
      setError(msg);
      throw e;
    } finally {
      setIsDerivingKey(false);
    }
  }, [connected, account, signMessage]);

  const encryptForUpload = useCallback(
    async (file: File): Promise<EncryptFileResult> => {
      setIsEncrypting(true);
      setError(null);
      try {
        const ownerKey = await ensureOwnerKey();
        return await encryptFile(file, ownerKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Encryption failed";
        setError(msg);
        throw e;
      } finally {
        setIsEncrypting(false);
      }
    },
    [ensureOwnerKey]
  );

  const encryptMany = useCallback(
    async (
      files: File[]
    ): Promise<EncryptFileResult[]> => {
      if (!files.length) return [];
      setIsEncrypting(true);
      setError(null);
      try {
        const ownerKey = await ensureOwnerKey();
        const results: EncryptFileResult[] = [];
        for (const file of files) {
          results.push(await encryptFile(file, ownerKey));
        }
        return results;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Encryption failed";
        setError(msg);
        throw e;
      } finally {
        setIsEncrypting(false);
      }
    },
    [ensureOwnerKey]
  );

  return {
    encryptForUpload,
    encryptMany,
    ensureOwnerKey,
    clearCachedKey,
    isDerivingKey,
    isEncrypting,
    isBusy: isDerivingKey || isEncrypting,
    error,
    canEncrypt: connected && !!account && !!signMessage,
  };
}

export type { EncryptionMaterial, EncryptFileResult };
