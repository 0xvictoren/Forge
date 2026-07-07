"use client";

import { useState } from "react";
import { toast } from "sonner";

export function VaultAssetAdder({
  vaultId,
  availableAssets,
}: {
  vaultId: string;
  availableAssets: { id: string; title: string }[];
}) {
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!selected) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to add");
      }
      toast.success("Asset added to vault");
      // naive reload to reflect
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Add failed");
    } finally {
      setAdding(false);
    }
  };

  if (!availableAssets.length) {
    return <p className="mt-6 text-xs text-[var(--text-muted)]">All your assets are already in this vault, or upload new ones.</p>;
  }

  return (
    <div className="mt-6 card p-4">
      <div className="text-sm font-medium mb-2">Add one of your assets</div>
      <div className="flex gap-2">
        <select className="input flex-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select asset…</option>
          {availableAssets.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
        <button onClick={add} disabled={!selected || adding} className="btn-primary px-5">Add</button>
      </div>
      <p className="mt-2 text-[10px] text-[var(--text-muted)]">Assets stay in your library. Vault controls visibility &amp; pricing for groups.</p>
    </div>
  );
}
