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

export function useShelbyWalletUpload() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
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
      options?: { expirationHours?: number }
    ): Promise<ShelbyUploadResult> => {
      const wallet = requireWallet();
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
        }
      );
    },
    [requireWallet]
  );

  const uploadFiles = useCallback(
    async (
      files: File[],
      kind: ShelbyUploadKind,
      options?: { expirationHours?: number }
    ): Promise<ShelbyUploadResult[]> => {
      const wallet = requireWallet();
      return uploadFilesToShelbyWithWallet(
        files,
        kind,
        wallet.account,
        wallet.signAndSubmitTransaction,
        wallet.mutate,
        options
      );
    },
    [requireWallet]
  );

  return {
    uploadFile,
    uploadFiles,
    isWalletReady: connected && !!account && !!signAndSubmitTransaction,
  };
}

/** @deprecated Use useShelbyWalletUpload */
export function useShelbyImageUpload() {
  const { uploadFile, isWalletReady } = useShelbyWalletUpload();
  return { uploadImage: uploadFile, isWalletReady };
}