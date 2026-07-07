"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderLock, Plus } from "lucide-react";
import { toast } from "sonner";

type VaultRow = {
  id: string;
  name: string;
  vaultType: string;
  visibility: string;
  isPublished: boolean;
  _count?: { assets: number; members: number };
};

export function VaultManager() {
  const [owned, setOwned] = useState<VaultRow[]>([]);
  const [shared, setShared] = useState<VaultRow[]>([]);
  const [name, setName] = useState("");
  const [vaultType, setVaultType] = useState("PRIVATE");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetch("/api/vaults")
      .then((r) => r.json())
      .then((d) => {
        setOwned(d.owned || []);
        setShared(d.shared || []);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, vaultType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Vault created");
      setName("");
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Vaults</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Organize assets with Dropbox-style folders and monetization rules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          New vault
        </button>
      </div>

      {showForm && (
        <div className="card mb-8 space-y-4 p-6">
          <input
            className="input"
            placeholder="Vault name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="input"
            value={vaultType}
            onChange={(e) => setVaultType(e.target.value)}
          >
            <option value="PRIVATE">Private</option>
            <option value="CREATOR">Creator</option>
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="COURSE">Course</option>
            <option value="TEAM">Team</option>
            <option value="CLIENT">Client</option>
          </select>
          <button
            type="button"
            className="btn-primary"
            onClick={create}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create vault"}
          </button>
        </div>
      )}

      <section>
        <h2 className="font-semibold">Your vaults</h2>
        {owned.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center p-12 text-center">
            <FolderLock className="mb-4 h-12 w-12 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)]">No vaults yet.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {owned.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vaults/${v.id}`}
                  className="card flex items-center justify-between p-4 hover:border-[var(--border-accent)]"
                >
                  <div>
                    <p className="font-medium">{v.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {v.vaultType} · {v._count?.assets || 0} assets
                    </p>
                  </div>
                  <span className="badge badge-free text-xs">{v.visibility}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shared.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Shared with you</h2>
          <ul className="mt-4 space-y-3">
            {shared.map((v) => (
              <li key={v.id}>
                <Link href={`/vaults/${v.id}`} className="card block p-4">
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
