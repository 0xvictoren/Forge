"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ShelbyUploader, { type ShelbyTxData } from "@/components/upload/shelby-uploader";
import { getExplorerUrl } from "@/lib/explorer";
import { useShelbyWalletUpload } from "@/hooks/use-shelby-wallet-upload";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";

export default function BurnLinkCreator() {
  const { account } = useWallet();
  const router = useRouter();
  const { uploadFile } = useShelbyWalletUpload();

  const [blobRefs, setBlobRefs] = useState<string[]>([]);
  const [thumbnailRef, setThumbnailRef] = useState<string | null>(null);
  const [txData, setTxData] = useState<ShelbyTxData | null>(null);
  const [priceApt, setPriceApt] = useState(0);
  const [maxViews, setMaxViews] = useState(10);
  const [title, setTitle] = useState("");
  const [walletGated, setWalletGated] = useState(false);
  const [allowedWalletsText, setAllowedWalletsText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleUploadSuccess = (refs: string[], data: ShelbyTxData) => {
    setBlobRefs(refs);
    setTxData(data);
    toast.success("File stored on Shelby!");
  };

  const createBurnLink = async () => {
    if (!blobRefs.length || !account) {
      toast.error("Upload a file first");
      return;
    }

    setIsCreating(true);

    try {
      const expiresAt = txData?.expirationMicros
        ? new Date(txData.expirationMicros / 1000)
        : undefined;

      const res = await fetch("/api/burnlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobRef: blobRefs[0],
          blobRefs,
          shelbyTxHash: txData?.shelbyTxHash,
          aptosTxHash: txData?.aptosTxHash,
          uploadTxHash: txData?.shelbyTxHash,
          storageTxHash: txData?.aptosTxHash,
          priceApt,
          maxViews,
          title: title || "Untitled BurnLink",
          expiresAt: expiresAt?.toISOString(),
          walletGated,
          allowedWallets: walletGated ? allowedWalletsText : [],
          thumbnailRef: thumbnailRef || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`BurnLink created — /b/${data.slug}`);
        router.push(`/b/${data.slug}`);
      } else {
        toast.error(data.error || "Failed to create BurnLink");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-8">
        <h2 className="text-2xl font-bold">Create BurnLink</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Pay storage fee, store on Shelby, then publish a shareable BurnLink.
        </p>

        <div className="mt-6">
          <ShelbyUploader
            mode="burnlink"
            storageFeeApt={0.5}
            maxFiles={1}
            onSuccess={handleUploadSuccess}
          />
        </div>

        {blobRefs.length > 0 && (
          <div className="mt-8 space-y-6">
            {txData?.shelbyTxHash && (
              <div className="rounded-2xl bg-[var(--bg-subtle)] p-3 font-mono text-xs">
                <span className="font-semibold">Shelby registration: </span>
                <a
                  href={getExplorerUrl(txData.shelbyTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[var(--brand)] hover:underline"
                >
                  {txData.shelbyTxHash}
                </a>
              </div>
            )}
            {txData?.aptosTxHash && (
              <div className="rounded-2xl bg-[var(--bg-subtle)] p-3 font-mono text-xs">
                <span className="font-semibold">Aptos storage fee: </span>
                <a
                  href={getExplorerUrl(txData.aptosTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[var(--brand)] hover:underline"
                >
                  {txData.aptosTxHash}
                </a>
              </div>
            )}
            <p className="break-all text-xs text-[var(--text-muted)]">Blob: {blobRefs[0]}</p>

            <div className="rounded-2xl border border-[var(--border-dim)] p-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Thumbnail (optional)</label>
                <label className="btn-accent-ghost cursor-pointer text-xs">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const uploaded = await uploadFile(f, "thumbnail");
                        setThumbnailRef(uploaded.blobRef);
                        toast.success("Thumbnail added");
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? formatShelbyUploadError(err.message)
                            : "Thumbnail upload failed"
                        );
                      }
                    }}
                  />
                </label>
              </div>
              {thumbnailRef ? (
                <img
                  src={getShelbyPublicUrl(thumbnailRef)}
                  alt="Thumbnail preview"
                  className="mt-3 h-20 w-auto rounded border border-[var(--border-dim)] object-cover"
                />
              ) : (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Used on Explore and your profile. A default image is used if omitted.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My premium asset"
                className="input mt-1"
              />
            </div>

            <div className="rounded-2xl border border-[var(--border-dim)] p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={walletGated}
                  onChange={(e) => setWalletGated(e.target.checked)}
                  className="rounded"
                />
                Private — wallet whitelist only
              </label>
              {walletGated && (
                <div className="mt-3">
                  <label className="block text-xs text-[var(--text-muted)]">
                    Allowed wallet addresses (one per line or comma-separated)
                  </label>
                  <textarea
                    value={allowedWalletsText}
                    onChange={(e) => setAllowedWalletsText(e.target.value)}
                    placeholder="0xabc…&#10;0xdef…"
                    rows={3}
                    className="input mt-1 font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Price (APT)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={priceApt}
                  onChange={(e) => setPriceApt(Number(e.target.value))}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Max views</label>
                <input
                  type="number"
                  min={1}
                  value={maxViews}
                  onChange={(e) => setMaxViews(Number(e.target.value))}
                  className="input mt-1"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={createBurnLink}
              disabled={isCreating}
              className="btn-primary w-full py-4 text-lg disabled:opacity-70"
            >
              {isCreating ? "Creating BurnLink…" : "Create shareable BurnLink"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
