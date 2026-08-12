"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

import { toast } from "sonner";
import Link from "next/link";
import ShelbyUploader, { type ShelbyTxData } from "@/components/upload/shelby-uploader";
import { EXPLORE_CATEGORIES, ASSET_TYPES, inferAssetType } from "@/lib/v2/constants";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { useI18n } from "@/components/providers/i18n-provider";

import { CheckCircle2 } from "lucide-react";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { CloudImport } from "@/components/upload/cloud-import";
import { useShelbyWalletUpload } from "@/hooks/use-shelby-wallet-upload";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";
import type { EncryptionMaterial } from "@/lib/encryption";
import { EncryptedBadge } from "@/components/ui/encrypted-badge";

type FileMeta = { name: string; size: number; mime: string };

type VaultOption = { id: string; name: string };
type AssetOption = { id: string; title: string };

export default function AssetCreator() {
  const { account } = useWallet();
  const { t } = useI18n();
  const { uploadFile } = useShelbyWalletUpload();

  const [blobRefs, setBlobRefs] = useState<string[]>([]);
  const [txData, setTxData] = useState<ShelbyTxData | null>(null);
  const [fileMetas, setFileMetas] = useState<FileMeta[]>([]);
  const [encryptionMaterials, setEncryptionMaterials] = useState<
    Array<EncryptionMaterial | null>
  >([]);


  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceApt, setPriceApt] = useState(0);
  const [category, setCategory] = useState("templates");
  const [assetType, setAssetType] = useState("OTHER");
  const [visibility, setVisibility] = useState<"public" | "vault-only" | "private">("public");
  const [tagsText, setTagsText] = useState("");
  const [thumbnailRef, setThumbnailRef] = useState<string | null>(null);
  const [publishToExplore, setPublishToExplore] = useState(true);
  const [createBurnLink, setCreateBurnLink] = useState(false);
  const [addToVault, setAddToVault] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [myExistingAssets, setMyExistingAssets] = useState<AssetOption[]>([]);
  const [existingAssetIds, setExistingAssetIds] = useState<string[]>([]);
  const [createAsBundle, setCreateAsBundle] = useState(false);

  const [uploadSource, setUploadSource] = useState<"local" | "cloud">("local");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<{ assetIds: string[]; bundleId?: string } | null>(null);

  useEffect(() => {
    if (account) {
      fetch("/api/vaults")
        .then((r) => r.json())
        .then((d) => setVaults((d.vaults || []).map((v: VaultOption) => ({ id: v.id, name: v.name }))))
        .catch(() => {});
      fetch("/api/assets?mine=1")
        .then((r) => r.json())
        .then((d) =>
          setMyExistingAssets(
            (d.assets || []).map((a: AssetOption) => ({ id: a.id, title: a.title }))
          )
        )
        .catch(() => {});
    }
  }, [account]);

  const toggleExistingAsset = (id: string) => {
    setExistingAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const bundleAssetCount = blobRefs.length + existingAssetIds.length;
  const canCreateBundle = createAsBundle && bundleAssetCount >= 2;

  useEffect(() => {
    if (fileMetas[0]) {
      setAssetType(inferAssetType(fileMetas[0].mime, fileMetas[0].name));
    }
  }, [fileMetas]);

  const handleUploadSuccess = (
    refs: string[],
    data: ShelbyTxData,
    metas?: FileMeta[],
    encMaterials?: Array<EncryptionMaterial | null>
  ) => {
    setBlobRefs(refs);
    setTxData(data);
    if (metas?.length) setFileMetas(metas);
    setEncryptionMaterials(encMaterials ?? refs.map(() => null));
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const uploaded = await uploadFile(f, "thumbnail");
      setThumbnailRef(uploaded.blobRef);
      toast.success("Thumbnail added");
    } catch (err) {
      toast.error(
        err instanceof Error ? formatShelbyUploadError(err.message) : "Thumb upload failed"
      );
    }
  };

  const publishAssets = async (asBundle = false) => {
    const makingBundle = asBundle || createAsBundle;

    if (blobRefs.length === 0 && existingAssetIds.length === 0) {
      toast.error("Upload files or select existing assets first");
      return;
    }
    if (!account) {
      toast.error("Connect wallet");
      return;
    }
    if (makingBundle && bundleAssetCount < 2) {
      toast.error("Bundles need at least 2 assets (uploaded + existing)");
      return;
    }
    if (!title.trim() && blobRefs.length === 1 && !makingBundle) {
      toast.error("Title is required");
      return;
    }
    if (makingBundle && !title.trim()) {
      toast.error("Bundle title is required");
      return;
    }

    setIsPublishing(true);
    setPublishSuccess(null);
    try {
      const tags = tagsText.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
      const created: { id: string }[] = [];
      const shouldList = publishToExplore && visibility === "public";

      for (let i = 0; i < blobRefs.length; i++) {
        const ref = blobRefs[i];
        const meta = fileMetas[i] || { name: `asset-${i}`, size: 0, mime: "application/octet-stream" };
        const enc = encryptionMaterials[i] || null;
        const res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobRef: ref,
            title: blobRefs.length > 1 ? (title.trim() || meta.name) : title.trim(),
            description: description.trim() || undefined,
            fileName: meta.name,
            mimeType: meta.mime,
            fileSize: meta.size,
            category,
            assetType,
            priceApt: makingBundle ? 0 : priceApt,
            visibility,
            tags,
            thumbnailRef: thumbnailRef || undefined,
            isListed: shouldList && !makingBundle,
            encryption: enc || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed asset publish");
        created.push(data.asset);

        if (addToVault && selectedVaultId) {
          await fetch(`/api/vaults/${selectedVaultId}/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId: data.asset.id }),
          }).catch(() => {});
        }
      }

      let bundleId: string | undefined;
      const allBundleAssetIds = [...existingAssetIds, ...created.map((a) => a.id)];

      if (makingBundle && allBundleAssetIds.length >= 2) {
        const bundleRes = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Course Pack",
            description: description || "Multi asset pack",
            priceApt,
            productType: "BUNDLE",
            assetIds: allBundleAssetIds,
            thumbnailRef: thumbnailRef || undefined,
          }),
        });
        const bundleData = await bundleRes.json();
        if (!bundleRes.ok) throw new Error(bundleData.error || "Bundle creation failed");
        bundleId = bundleData.product?.id;

        if (shouldList && bundleId) {
          await fetch("/api/products", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: bundleId, isListed: true }),
          });
        }
      }

      if (createBurnLink && created.length === 1) {
        toast.info("BurnLink can be created from the BurnLink upload tab for gated sharing.");
      }

      setPublishSuccess({ assetIds: created.map((a) => a.id), bundleId });
      toast.success(
        shouldList
          ? `${created.length} asset(s) published and listed on Explore!`
          : `${created.length} asset(s) published. Enable listing from your Dashboard.`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const resetForm = () => {
    setBlobRefs([]);
    setFileMetas([]);
    setEncryptionMaterials([]);

    setThumbnailRef(null);
    setTxData(null);
    setPublishSuccess(null);

    setTitle("");
    setDescription("");
  };

  if (publishSuccess) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--green)]" />
        <h2 className="mt-4 text-2xl font-semibold">Published successfully!</h2>
        <p className="mt-2 text-[var(--text-secondary)]">
          Your {publishSuccess.assetIds.length} asset(s) are on Shelby and saved to your catalog.
        </p>
        {publishSuccess.bundleId && (
          <div className="mt-6 rounded-xl border border-[var(--border-dim)] bg-[var(--bg-subtle)] p-4 text-left">
            <p className="text-sm font-semibold">Bundle link</p>
            <p className="mt-1 break-all font-mono text-xs text-[var(--text-secondary)]">
              {typeof window !== "undefined"
                ? `${window.location.origin}/products/${publishSuccess.bundleId}`
                : `/products/${publishSuccess.bundleId}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyLinkButton
                url={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/products/${publishSuccess.bundleId}`
                    : `/products/${publishSuccess.bundleId}`
                }
              />
              <Link href="/library" className="btn-accent-ghost text-sm">
                View in Library
              </Link>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {publishSuccess.assetIds.length === 1 && !publishSuccess.bundleId && (
            <Link href={`/assets/${publishSuccess.assetIds[0]}`} className="btn-primary">
              View asset
            </Link>
          )}
          <Link href="/explore" className="btn-brand">
            Browse Explore
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Creator Dashboard
          </Link>
        </div>
        <button onClick={resetForm} className="mt-4 text-xs text-[var(--text-muted)] underline">
          Upload another
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="label-caps">{t("create_asset") || "Create Asset"}</div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("upload_publish") || "Upload & publish"}
        </h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          Upload to Shelby, set your price, and publish to the marketplace.
        </p>
      </div>

      {blobRefs.length === 0 ? (
        <div>
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setUploadSource("local")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                uploadSource === "local"
                  ? "bg-[var(--charcoal)] text-[var(--text-cream)]"
                  : "border border-[var(--border-dim)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Local upload
            </button>
            <button
              type="button"
              onClick={() => setUploadSource("cloud")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                uploadSource === "cloud"
                  ? "bg-[var(--charcoal)] text-[var(--text-cream)]"
                  : "border border-[var(--border-dim)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Import from Google Drive
            </button>
          </div>

          {uploadSource === "local" ? (
            <>
              <ShelbyUploader
                mode="media"
                storageFeeApt={0}
                maxFiles={10}
                encrypt
                showEncryptToggle
                acceptedTypes="image/*,video/*,audio/*,.pdf,.zip,.txt,.md,.js,.ts,.tsx,.json,.csv"
                onSuccess={handleUploadSuccess}
              />
              <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
                Supports PDF, video, audio, images, code, and packs. Encrypted uploads store
                ciphertext only on ShelbyNet.
              </p>
            </>
          ) : (
            <CloudImport onImportSuccess={handleUploadSuccess} />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--green)]" />
              <p className="font-medium">{blobRefs.length} file(s) uploaded to Shelby</p>
              {encryptionMaterials.some((m) => m?.isEncrypted) && <EncryptedBadge size="sm" />}
            </div>

            <ul className="mt-3 text-xs text-[var(--text-muted)] max-h-24 overflow-auto">
              {blobRefs.map((ref, i) => (
                <li key={i} className="break-all font-mono">
                  {fileMetas[i]?.name || `file-${i}`} ✓
                  {encryptionMaterials[i]?.isEncrypted ? " · encrypted" : ""}
                </li>
              ))}
            </ul>
            {txData?.shelbyTxHash && (
              <p className="mt-1 text-[10px] text-[var(--brand)]">Shelby tx recorded</p>
            )}

            <div className="mt-5 border-t border-[var(--border-dim)] pt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Thumbnail (optional)</div>
                <label className="btn-accent-ghost cursor-pointer text-xs">
                  Upload thumb
                  <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
                </label>
              </div>
              {thumbnailRef && (
                <img
                  src={getShelbyPublicUrl(thumbnailRef)}
                  alt="thumb"
                  className="mt-3 h-20 w-auto rounded border border-[var(--border-dim)] object-cover"
                />
              )}
            </div>
          </div>

          <div className="card space-y-6 p-6">
            <div>
              <label className="block text-sm font-medium">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notion template pack, Pro photos, Course videos..."
                className="input mt-1.5 text-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What buyers get, formats included, usage rights..."
                className="input mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium">Price (APT)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={priceApt}
                  onChange={(e) => setPriceApt(Math.max(0, Number(e.target.value)))}
                  className="input mt-1.5 text-xl font-semibold"
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">0 = free. 2% platform fee.</p>
              </div>

              <div>
                <label className="block text-sm font-medium">Asset type</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="input mt-1.5"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input mt-1.5"
                >
                  {EXPLORE_CATEGORIES.filter((c) => c !== "all").map((c) => (
                    <option key={c} value={c}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Tags</label>
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="notion, productivity, starter (comma or space separated)"
                className="input mt-1.5"
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Visibility &amp; Access</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { v: "public", label: "Public", desc: "Anyone can discover and buy." },
                  { v: "vault-only", label: "Vault only", desc: "Only vault members." },
                  { v: "private", label: "Private", desc: "Only you." },
                ].map(({ v, label, desc }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v as typeof visibility)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      visibility === v
                        ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-dim)] hover:border-[var(--border-accent)]"
                    }`}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--border-dim)] p-4">
              <p className="text-sm font-medium">Publishing options</p>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={publishToExplore}
                  onChange={(e) => setPublishToExplore(e.target.checked)}
                  disabled={visibility !== "public"}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Publish to Explore</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    List on the marketplace immediately after publishing.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={createBurnLink}
                  onChange={(e) => setCreateBurnLink(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Also create BurnLink</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    Gated shareable link with optional paywall (use BurnLink tab for full setup).
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={addToVault}
                  onChange={(e) => setAddToVault(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Add to Vault</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    Organize into an existing vault after publish.
                  </span>
                </span>
              </label>

              {addToVault && (
                <select
                  value={selectedVaultId}
                  onChange={(e) => setSelectedVaultId(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Select vault…</option>
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
              {addToVault && vaults.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  No vaults yet. <Link href="/vaults" className="text-[var(--accent)]">Create one</Link>
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--border-dim)] p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={createAsBundle}
                  onChange={(e) => setCreateAsBundle(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Create as bundle</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    Combine new uploads with existing assets into one pack ({bundleAssetCount} selected).
                  </span>
                </span>
              </label>

              {createAsBundle && myExistingAssets.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Include existing assets</p>
                  <div className="max-h-36 space-y-1 overflow-auto rounded border border-[var(--border-dim)] p-2">
                    {myExistingAssets.map((a) => (
                      <label
                        key={a.id}
                        className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-[var(--bg-hover)]"
                      >
                        <input
                          type="checkbox"
                          checked={existingAssetIds.includes(a.id)}
                          onChange={() => toggleExistingAsset(a.id)}
                        />
                        <span className="truncate">{a.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {!createAsBundle && (
                <button
                  onClick={() => publishAssets(false)}
                  disabled={isPublishing || blobRefs.length === 0}
                  className="btn-brand flex-1 py-4 text-base disabled:opacity-60"
                >
                  {isPublishing ? "Publishing…" : `Publish ${blobRefs.length} asset(s)`}
                </button>
              )}
              {(createAsBundle || blobRefs.length > 1) && (
                <button
                  onClick={() => publishAssets(true)}
                  disabled={isPublishing || !canCreateBundle}
                  className="btn-primary flex-1 py-4 text-base disabled:opacity-60"
                >
                  {isPublishing
                    ? "Creating bundle…"
                    : `Create bundle (${bundleAssetCount} assets)`}
                </button>
              )}
            </div>
          </div>

          <button onClick={resetForm} className="text-xs text-[var(--text-muted)] underline">
            ← Upload different files
          </button>
        </div>
      )}
    </div>
  );
}