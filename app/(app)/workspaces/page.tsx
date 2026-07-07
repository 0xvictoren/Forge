"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";

type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  owner?: { displayName?: string | null; username?: string | null };
};

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((d) => setWorkspaces(d.workspaces || []));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed");
      return;
    }
    toast.success("Workspace created");
    setName("");
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Workspaces</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Project hubs with chat, files, invoices, and deliverables.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          New workspace
        </button>
      </div>

      {showForm && (
        <div className="card mb-8 flex gap-3 p-4">
          <input
            className="input flex-1"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="btn-primary" onClick={create}>
            Create
          </button>
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <Briefcase className="mb-4 h-12 w-12 text-[var(--text-muted)]" />
          <p className="text-[var(--text-secondary)]">No workspaces yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link
                href={`/workspaces/${w.id}`}
                className="card block p-4 hover:border-[var(--border-accent)]"
              >
                <p className="font-medium">{w.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{w.status}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
