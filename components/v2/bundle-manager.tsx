"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Package, Edit2, Trash2 } from "lucide-react";
import { useShelbyWalletUpload } from "@/hooks/use-shelby-wallet-upload";
import { getShelbyPublicUrl } from "@/lib/shelby-public";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { formatShelbyUploadError } from "@/lib/shelby-upload-errors";

type Product = {
  id: string;
  title: string;
  description?: string | null;
  priceApt: number;
  productType: string;
  isActive: boolean;
  isListed: boolean;
  thumbnailRef?: string | null;
  items?: { asset?: { id: string; title: string } | null; assetId?: string }[];
  _count?: { items?: number };
};

type AssetOption = { id: string; title: string };

export function BundleManager() {
  const { uploadFile } = useShelbyWalletUpload();
  const [products, setProducts] = useState<Product[]>([]);
  const [thumbnailRef, setThumbnailRef] = useState<string | null>(null);
  const [myAssets, setMyAssets] = useState<AssetOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceApt, setPriceApt] = useState(0);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isListed, setIsListed] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [prodRes, assetsRes] = await Promise.all([
      fetch("/api/products?userId=me"),
      fetch("/api/assets?mine=1"),
    ]);
    const prods = await prodRes.json();
    const as = await assetsRes.json();
    setProducts(prods.products || []);
    setMyAssets((as.assets || []).map((a: { id: string; title: string }) => ({ id: a.id, title: a.title })));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openCreate = () => {
    setEditingProduct(null);
    setTitle("");
    setDescription("");
    setPriceApt(0);
    setSelectedAssetIds([]);
    setIsListed(false);
    setThumbnailRef(null);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setTitle(p.title);
    setDescription(p.description || "");
    setPriceApt(p.priceApt);
    setIsListed(p.isListed);
    setSelectedAssetIds(
      (p.items || []).map((i) => i.asset?.id).filter(Boolean) as string[]
    );
    setThumbnailRef(p.thumbnailRef || null);
    setShowForm(true);
  };

  const saveBundle = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      if (editingProduct) {
        const currentItemAssetIds = (editingProduct.items || [])
          .map((i) => i.asset?.id)
          .filter(Boolean) as string[];
        const toRemove = currentItemAssetIds.filter((id) => !selectedAssetIds.includes(id));
        const toAdd = selectedAssetIds.filter((id) => !currentItemAssetIds.includes(id));

        const res = await fetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: editingProduct.id,
            title,
            description: description || undefined,
            priceApt,
            isListed,
            thumbnailRef: thumbnailRef || undefined,
            addAssetIds: toAdd,
            removeAssetIds: toRemove,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update bundle");
        toast.success("Bundle updated");
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            priceApt,
            productType: "BUNDLE",
            assetIds: selectedAssetIds,
            thumbnailRef: thumbnailRef || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        toast.success("Bundle created");
      }
      setShowForm(false);
      setEditingProduct(null);
      setTitle("");
      setDescription("");
      setPriceApt(0);
      setSelectedAssetIds([]);
      setIsListed(false);
      setThumbnailRef(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleList = async (p: Product) => {
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, isListed: !p.isListed }),
      });
      if (!res.ok) throw new Error("Failed to update listing");
      toast.success(p.isListed ? "Delisted from explorer" : "Listed in explorer");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const deleteBundle = async (id: string) => {
    if (!confirm("Delete this bundle? (Assets remain on Shelby)")) return;
    try {
      await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, isActive: false }),
      });
      toast.success("Bundle removed from your active bundles");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Bundles &amp; Packs</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Create bundles from assets you own. List them to make available in explorer.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" /> New Bundle
        </button>
      </div>

      {showForm && (
        <div className="card mb-8 space-y-4 p-6">
          <div className="flex justify-between">
            <div className="font-semibold">
              {editingProduct ? "Edit Bundle" : "Create Bundle"}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}
              className="text-sm"
            >
              Cancel
            </button>
          </div>
          <input
            className="input"
            placeholder="Bundle title e.g. AI Creator Pack"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input"
            placeholder="Description of what's included"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="rounded-lg border border-[var(--border-dim)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Thumbnail (optional)</span>
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
            {thumbnailRef && (
              <img
                src={getShelbyPublicUrl(thumbnailRef)}
                alt=""
                className="mt-2 h-16 rounded border border-[var(--border-dim)] object-cover"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Price (APT)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                className="input"
                value={priceApt}
                onChange={(e) => setPriceApt(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isListed}
                  onChange={(e) => setIsListed(e.target.checked)}
                />
                List in Explorer
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">
              Select assets ({selectedAssetIds.length})
            </div>
            <div className="max-h-48 space-y-1 overflow-auto rounded border border-[var(--border-dim)] bg-[var(--bg-elevated)] p-2">
              {myAssets.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">Upload assets first.</p>
              )}
              {myAssets.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-[var(--bg-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedAssetIds.includes(a.id)}
                    onChange={() => toggleAsset(a.id)}
                  />
                  <span>{a.title}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={saveBundle}
            disabled={creating || !title.trim()}
            className="btn-primary w-full"
          >
            {creating ? "Saving…" : editingProduct ? "Save changes" : "Create bundle"}
          </button>
        </div>
      )}

      <section>
        <h2 className="font-semibold">Your bundles</h2>
        {products.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center p-12 text-center">
            <Package className="mb-4 h-12 w-12 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)]">No bundles yet.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {products.map((p) => (
              <li key={p.id} className="card flex items-start justify-between p-4">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {p.productType} · {p.items?.length || 0} items · {p.priceApt} APT
                    {p.isListed ? " · Listed" : " · Not listed"}
                  </p>
                  {p.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-[var(--text-secondary)]">
                      {p.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="btn-accent-ghost px-2 py-0.5"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleList(p)}
                      className="btn-accent-ghost px-2 py-0.5"
                    >
                      {p.isListed ? "Delist" : "List"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBundle(p.id)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <CopyLinkButton
                    url={
                      typeof window !== "undefined"
                        ? `${window.location.origin}/products/${p.id}`
                        : `/products/${p.id}`
                    }
                    compact
                    label="Copy link"
                  />
                  <Link href={`/products/${p.id}`} className="text-[var(--accent)]">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
