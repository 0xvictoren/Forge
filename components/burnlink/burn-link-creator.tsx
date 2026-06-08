"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ShelbyUploader, { type ShelbyTxData } from "@/components/upload/shelby-uploader";
import { getExplorerUrl } from "@/lib/explorer";

export default function BurnLinkCreator() {
  const { account } = useWallet();
  const router = useRouter();

  const [blobRefs, setBlobRefs] = useState<string[]>([]);
  const [txData, setTxData] = useState<ShelbyTxData | null>(null);
  const [priceApt, setPriceApt] = useState(0);
  const [maxViews, setMaxViews] = useState(10);
  const [title, setTitle] = useState("");
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
        <h2 className="text-2xl font-bold">Upload file</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Pay storage fee, upload to Shelby, then set rules and get a shareable link.
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
