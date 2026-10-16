"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [modelName, setModelName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (name.trim().length < 2) return toast.error("Name your project");
    setBusy(true);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), modelName: modelName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project");
      router.push(`/compliance/${data.project.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> New record
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="np-title"
              initial={{ y: 30, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="glass glass-strong relative w-full max-w-md rounded-[32px] p-6"
            >
              <h2 id="np-title" className="title-lg">New compliance record</h2>
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">One record per model or training run.</p>
              <div className="mt-5 space-y-3">
                <div>
                  <label className="field-label" htmlFor="np-name">Record name</label>
                  <input id="np-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grasping policy, Q4 release" autoFocus />
                </div>
                <div>
                  <label className="field-label" htmlFor="np-model">Model name <span className="font-normal text-[var(--text-muted)]">(optional)</span></label>
                  <input id="np-model" className="field" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="acme-grasp-v2" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={create} disabled={busy} className="btn-primary">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
