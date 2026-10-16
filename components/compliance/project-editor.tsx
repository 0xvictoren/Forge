"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BadgeCheck, Download, FileText, Loader2, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassSwitch } from "@/components/glass/glass-switch";
import { formatBytes } from "@/lib/datasets/modalities";

export type Source = {
  id: string;
  kind: "license" | "own";
  title: string;
  subtitle: string;
  sizeBytes: number;
  anchored: boolean;
};

export function ProjectEditor({
  project,
  sources,
}: {
  project: { id: string; name: string; modelName: string | null; providerName: string | null; purpose: string | null; licenseIds: string[]; datasetVersionIds: string[] };
  sources: Source[];
}) {
  const router = useRouter();
  const [details, setDetails] = useState({ name: project.name, modelName: project.modelName ?? "", providerName: project.providerName ?? "", purpose: project.purpose ?? "" });
  const [licenseIds, setLicenseIds] = useState(new Set(project.licenseIds));
  const [versionIds, setVersionIds] = useState(new Set(project.datasetVersionIds));
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () =>
      details.name !== project.name ||
      details.modelName !== (project.modelName ?? "") ||
      details.providerName !== (project.providerName ?? "") ||
      details.purpose !== (project.purpose ?? "") ||
      [...licenseIds].sort().join() !== [...project.licenseIds].sort().join() ||
      [...versionIds].sort().join() !== [...project.datasetVersionIds].sort().join(),
    [details, licenseIds, versionIds, project]
  );

  const toggle = (s: Source, on: boolean) => {
    const setter = s.kind === "license" ? setLicenseIds : setVersionIds;
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(s.id);
      else next.delete(s.id);
      return next;
    });
  };

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: details.name.trim(),
          modelName: details.modelName.trim() || null,
          providerName: details.providerName.trim() || null,
          purpose: details.purpose.trim() || null,
          licenseIds: [...licenseIds],
          datasetVersionIds: [...versionIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Record saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this record? Sources and licences are not affected.")) return;
    const res = await fetch(`/api/compliance/${project.id}`, { method: "DELETE" });
    if (res.ok) router.push("/compliance");
    else toast.error("Could not delete");
  }

  const selectedCount = licenseIds.size + versionIds.size;
  const licensed = sources.filter((s) => s.kind === "license");
  const own = sources.filter((s) => s.kind === "own");

  const group = (title: string, items: Source[], empty: React.ReactNode) => (
    <div>
      <h3 className="text-[13px] font-semibold text-[var(--text-secondary)]">{title}</h3>
      {items.length === 0 ? (
        <div className="mt-2 rounded-[20px] bg-[var(--bg-surface)] p-4 text-[14px] text-[var(--text-secondary)]">{empty}</div>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border-dim)] overflow-hidden rounded-[20px] border border-[var(--border-dim)]">
          {items.map((s) => {
            const on = s.kind === "license" ? licenseIds.has(s.id) : versionIds.has(s.id);
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                {s.kind === "license" ? <ScrollText className="h-4 w-4 shrink-0 text-[var(--accent-ink)]" /> : <BadgeCheck className={`h-4 w-4 shrink-0 ${s.anchored ? "text-[var(--green)]" : "text-[var(--text-muted)]"}`} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{s.title}</p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {s.subtitle} · {formatBytes(s.sizeBytes)}
                  </p>
                </div>
                <GlassSwitch checked={on} onChange={(v) => toggle(s, v)} label={`Include ${s.title}`} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="surface p-6">
          <h2 className="title">Data sources</h2>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Switch on every dataset used to train this model.</p>
          <div className="mt-6 space-y-6">
            {group(
              "Licensed on Forge",
              licensed,
              <>
                No licences yet. <Link href="/datasets" className="text-[var(--accent-ink)]">Browse datasets</Link>
              </>
            )}
            {group(
              "Your sealed datasets",
              own,
              <>
                Seal your own training data privately to cite it here. <Link href="/studio/new" className="text-[var(--accent-ink)]">Seal a dataset</Link>
              </>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <section className="surface space-y-4 p-6">
          <h2 className="title">Details</h2>
          <div>
            <label className="field-label" htmlFor="pe-name">Record name</label>
            <input id="pe-name" className="field" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="pe-model">Model</label>
            <input id="pe-model" className="field" value={details.modelName} onChange={(e) => setDetails({ ...details, modelName: e.target.value })} placeholder="acme-grasp-v2" />
          </div>
          <div>
            <label className="field-label" htmlFor="pe-provider">Provider</label>
            <input id="pe-provider" className="field" value={details.providerName} onChange={(e) => setDetails({ ...details, providerName: e.target.value })} placeholder="Acme Robotics Ltd" />
          </div>
          <div>
            <label className="field-label" htmlFor="pe-purpose">Intended purpose</label>
            <textarea id="pe-purpose" className="field" style={{ minHeight: 90 }} value={details.purpose} onChange={(e) => setDetails({ ...details, purpose: e.target.value })} />
          </div>
        </section>

        <AnimatePresence>
          {dirty && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="surface p-6">
          <h2 className="title">Export</h2>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{selectedCount} source{selectedCount === 1 ? "" : "s"} included{dirty ? ", save first" : ""}.</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href={`/compliance/${project.id}/report`} className={`btn-primary ${dirty ? "pointer-events-none opacity-40" : ""}`}>
              <FileText className="h-4 w-4" /> Open report
            </Link>
            <a href={`/api/compliance/${project.id}/export`} className={`btn-secondary ${dirty ? "pointer-events-none opacity-40" : ""}`}>
              <Download className="h-4 w-4" /> Download JSON
            </a>
          </div>
        </section>

        <button type="button" onClick={remove} className="btn-plain btn-sm mx-auto flex text-[var(--red)]">
          <Trash2 className="h-3.5 w-3.5" /> Delete record
        </button>
      </aside>
    </div>
  );
}
