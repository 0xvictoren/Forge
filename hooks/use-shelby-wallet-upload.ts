"use client";

import { useCallback } from "react";
import { useUploadBlobs } from "@shelby-protocol/react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import {
  uploadFileToShelbyWithWallet,
  uploadFilesToShelbyWithWallet,
  type ShelbyUploadKind,
  type ShelbyUploadResult,
} from "@/lib/shelby-wallet-upload";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";
import { useContentEncryption } from "@/hooks/use-content-encryption";

export function useShelbyWalletUpload() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const { encryptForUpload, isBusy: isEncrypting, canEncrypt } =
    useContentEncryption();
  const uploadBlobs = useUploadBlobs({
    onError: (err) => toast.error(formatShelbyUploadError(err.message)),
  });

  const requireWallet = useCallback(() => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error("Connect your wallet to upload to Shelby");
      throw new Error("Wallet not connected");
    }
    return {
      account: account as Parameters<typeof uploadFileToShelbyWithWallet>[2],
      signAndSubmitTransaction: signAndSubmitTransaction as Parameters<
        typeof uploadFileToShelbyWithWallet
      >[3],
      mutate: (params: Parameters<typeof uploadBlobs.mutateAsync>[0]) =>
        uploadBlobs.mutateAsync(params as never),
    };
  }, [account, connected, signAndSubmitTransaction, uploadBlobs]);

  const uploadFile = useCallback(
    async (
      file: File,
      kind: ShelbyUploadKind,
      options?: { expirationHours?: number; encrypt?: boolean }
    ): Promise<ShelbyUploadResult> => {
      const wallet = requireWallet();
      const shouldEncrypt = !!options?.encrypt;
      if (shouldEncrypt && !canEncrypt) {
        throw new Error("Wallet cannot sign messages required for encryption");
      }
      return uploadFileToShelbyWithWallet(
        file,
        kind,
        wallet.account,
        wallet.signAndSubmitTransaction,
        wallet.mutate,
        {
          expirationHours:
            options?.expirationHours ??
            (kind === "avatar" || kind === "banner" ? 365 * 24 : undefined),
          encryptFile: shouldEncrypt ? encryptForUpload : undefined,
        }
      );
    },
    [requireWallet, encryptForUpload, canEncrypt]
  );

  const uploadFiles = useCallback(
    async (
      files: File[],
      kind: ShelbyUploadKind,
      options?: { expirationHours?: number; encrypt?: boolean }
    ): Promise<ShelbyUploadResult[]> => {
      const wallet = requireWallet();
      const shouldEncrypt = !!options?.encrypt;
      if (shouldEncrypt && !canEncrypt) {
        throw new Error("Wallet cannot sign messages required for encryption");
      }
      return uploadFilesToShelbyWithWallet(
        files,
        kind,
        wallet.account,
        wallet.signAndSubmitTransaction,
        wallet.mutate,
        {
          expirationHours: options?.expirationHours,
          encryptFile: shouldEncrypt ? encryptForUpload : undefined,
        }
      );
    },
    [requireWallet, encryptForUpload, canEncrypt]
  );

  return {
    uploadFile,
    uploadFiles,
    isWalletReady: connected && !!account && !!signAndSubmitTransaction,
    isEncrypting,
    canEncrypt,
  };
}

/** @deprecated Use useShelbyWalletUpload */
export function useShelbyImageUpload() {
  const { uploadFile, isWalletReady } = useShelbyWalletUpload();
  return { uploadImage: uploadFile, isWalletReady };
}
