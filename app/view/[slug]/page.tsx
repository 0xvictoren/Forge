"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Download, Clock, Eye } from "lucide-react";
import { AccountAddress } from "@aptos-labs/ts-sdk";

type BurnlinkAccess = {
  title?: string;
  fileName?: string;
  streamUrl?: string;
  mimeType?: string;
  remainingViews?: number | null;
  expiresAt?: string | null;
  expiresIn?: string | null;
  screenshotProtected?: boolean;
  disableDownload?: boolean;
  slug?: string;
  error?: string;
};

function normalizeWallet(addr: string) {
  try {
    return AccountAddress.fromString(addr).toString().toLowerCase();
  } catch {
    return addr.trim().toLowerCase();
  }
}

export default function BurnLinkViewer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { connected, account } = useWallet();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const token = searchParams.get("token");

  const [burnlink, setBurnlink] = useState<BurnlinkAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blurred, setBlurred] = useState(false);

  const walletAddress = connected && account ? normalizeWallet(account.address.toString()) : "";

  const loadAccess = useCallback(async () => {
    if (!slug || !token || !walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/burnlinks/${slug}/access?token=${encodeURIComponent(token)}&walletAddress=${encodeURIComponent(walletAddress)}`
      );
      const data: BurnlinkAccess = await res.json();
      if (data.error || !res.ok) {
        setError(data.error || "Access denied");
        setBurnlink(null);
      } else {
        setBurnlink(data);
      }
    } catch {
      setError("Failed to load file");
      setBurnlink(null);
    } finally {
      setLoading(false);
    }
  }, [slug, token, walletAddress]);

  useEffect(() => {
    if (!slug || !token) {
      setError("Invalid or missing access token");
      setLoading(false);
      return;
    }
    if (!connected || !walletAddress) {
      setLoading(false);
      return;
    }
    loadAccess();
  }, [slug, token, connected, walletAddress, loadAccess]);

  useEffect(() => {
    if (!burnlink?.screenshotProtected) return;

    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);
    const onCtx = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("contextmenu", onCtx);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("contextmenu", onCtx);
    };
  }, [burnlink?.screenshotProtected]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#d4d4d4] p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center">
          <p className="font-medium text-red-600">Invalid or missing access token</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#d4d4d4] p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center">
          <p className="font-medium">Connect your wallet to view this file</p>
          <p className="mt-2 text-sm text-gray-500">
            Access is bound to the wallet that unlocked this BurnLink.
          </p>
          <div className="mt-6">
            <ConnectWallet className="w-full justify-center" />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#d4d4d4]">
        <p className="text-lg">Verifying access…</p>
      </div>
    );
  }

  if (error || !burnlink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#d4d4d4] p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center">
          <p className="font-medium text-red-600">{error || "Access denied"}</p>
          <p className="mt-2 text-sm text-gray-500">
            This file is locked to a specific wallet. Connect the wallet that paid to unlock.
          </p>
        </div>
      </div>
    );
  }

  const mediaUrl = burnlink.streamUrl || "";
  const downloadFileName = burnlink.fileName || burnlink.title || "download";
  const downloadUrl = mediaUrl
    ? `${mediaUrl}${mediaUrl.includes("?") ? "&" : "?"}download=1&filename=${encodeURIComponent(downloadFileName)}`
    : "";
  const expiresLabel = burnlink.expiresAt
    ? new Date(burnlink.expiresAt).toLocaleString()
    : "No expiry";

  return (
    <div className="relative min-h-screen bg-[#d4d4d4] p-6">
      {blurred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
          <p className="text-white">Content hidden — return to tab</p>
        </div>
      )}

      <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="border-b p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-xl">
              📄
            </div>
            <div>
              <h1 className="text-xl font-semibold">{burnlink.title || "BurnLink file"}</h1>
              <p className="text-sm text-gray-500">Protected file on Shelby</p>
            </div>
          </div>
        </div>

        <div className="border-b bg-gray-50 p-6 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-orange-600">
              Expires in {burnlink.expiresIn || "—"}
            </p>
            <div className="flex items-center gap-4 text-gray-500">
              <div className="flex items-center gap-1">
                <Eye size={16} />
                <span>{burnlink.remainingViews ?? "∞"} views left</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>{expiresLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {mediaUrl ? (
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-black">
              {burnlink.mimeType?.startsWith("image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl}
                  alt={burnlink.title || "BurnLink file"}
                  className="max-h-[500px] w-auto object-contain"
                />
              ) : burnlink.mimeType?.startsWith("video") ? (
                <video src={mediaUrl} controls className="max-h-[500px] w-full" />
              ) : (
                <div className="py-12 text-center">
                  <p className="mb-4 text-gray-400">File ready for download</p>
                  {!burnlink.disableDownload && downloadUrl && (
                    <a
                      href={downloadUrl}
                      download={burnlink.fileName || burnlink.title || "download"}
                      className="inline-flex items-center gap-2 rounded-2xl bg-black px-8 py-4 font-medium text-white"
                    >
                      <Download size={20} />
                      Download File
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="py-12 text-center text-gray-400">No file attached</p>
          )}
        </div>

        {!burnlink.disableDownload && mediaUrl && (
          <div className="border-t bg-gray-50 p-6">
            <a
              href={downloadUrl}
              download={burnlink.fileName || burnlink.title || "download"}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-center font-semibold text-white"
            >
              <Download size={20} />
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
