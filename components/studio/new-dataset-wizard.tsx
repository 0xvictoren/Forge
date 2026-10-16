"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, Globe, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CoverPicker } from "./cover-picker";
import { FilesStep, type ExistingFile } from "./files-step";
import { DatasheetForm, EMPTY_DATASHEET, toDatasheet, type DatasheetDraft } from "./datasheet-form";
import { OffersEditor } from "./offers-editor";
import { AgentPricingEditor } from "./agent-pricing";
import { DEFAULT_READ_PRICING, type ReadPricing } from "@/lib/agents/pricing";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { useSealVersion } from "@/hooks/use-seal-version";
import { MODALITIES } from "@/lib/datasets/modalities";
import { validateDatasheet } from "@/lib/datasets/manifest";
import type { LicenseOffer } from "@/lib/datasets/licenses";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/datasets/modalities";

type Step = "basics" | "files" | "datasheet" | "offers" | "seal" | "done";

export type WizardInitial = {
  dataset: {
    id: string;
    slug: string;
    title: string;
    tagline: string | null;
    description: string | null;
    modality: string;
    tags: string[];
    coverUrl: string | null;
    visibility: string;
    offers: LicenseOffer[];
  };
  version: { id: string; versionNumber: number };
  files: ExistingFile[];
};

const LABELS: Record<Step, string> = {
  basics: "Details",
  files: "Files",
  datasheet: "Datasheet",
  offers: "Licences",
  seal: "Seal",
  done: "Done",
};

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data as T;
}

export function NewDatasetWizard({ initial }: { initial?: WizardInitial }) {
  const [step, setStep] = useState<Step>(initial ? "files" : "basics");
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(initial?.dataset.title ?? "");
  const [tagline, setTagline] = useState(initial?.dataset.tagline ?? "");
  const [description, setDescription] = useState(initial?.dataset.description ?? "");
  const [modality, setModality] = useState(initial?.dataset.modality ?? "VIDEO");
  const [tags, setTags] = useState(initial?.dataset.tags.join(", ") ?? "");
  const [cover, setCover] = useState<{ url: string; credit: string } | null>(initial?.dataset.coverUrl ? { url: initial.dataset.coverUrl, credit: "" } : null);
  const [visibility, setVisibility] = useState<"listed" | "private">((initial?.dataset.visibility as "listed" | "private") ?? "listed");

  const [ids, setIds] = useState<{ datasetId: string; slug: string; versionId: string; versionNumber: number } | null>(
    initial ? { datasetId: initial.dataset.id, slug: initial.dataset.slug, versionId: initial.version.id, versionNumber: initial.version.versionNumber } : null
  );
  const [files, setFiles] = useState<ExistingFile[]>(initial?.files ?? []);
  const [sheet, setSheet] = useState<DatasheetDraft>(EMPTY_DATASHEET);
  const [offers, setOffers] = useState<LicenseOffer[]>(
    initial?.dataset.offers.length ? initial.dataset.offers : [{ template: "RESEARCH", priceApt: 0 }, { template: "COMMERCIAL", priceApt: 25 }]
  );
  const [readPricing, setReadPricing] = useState<ReadPricing>({ ...DEFAULT_READ_PRICING, enabled: true });
  const { seal, phase } = useSealVersion();
  const [result, setResult] = useState<{ sealHash: string; anchorTxHash: string | null } | null>(null);

  const steps: Step[] = visibility === "listed" ? ["basics", "files", "datasheet", "offers", "seal"] : ["basics", "files", "datasheet", "seal"];
  const index = steps.indexOf(step);

  const go = (next: Step) => {
    setDir(steps.indexOf(next) >= index ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const refreshFiles = useCallback(async () => {
    if (!ids) return;
    const data = await api<{ files: ExistingFile[] }>(`/api/datasets/versions/${ids.versionId}/files`, "GET");
    setFiles(data.files);
  }, [ids]);

  useEffect(() => {
    if (initial) void refreshFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBasics() {
    if (title.trim().length < 3) return toast.error("Give your dataset a title");
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        modality,
        tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12),
        coverUrl: cover?.url,
        coverCredit: cover?.credit || undefined,
        visibility,
      };
      if (ids) {
        await api(`/api/datasets/${ids.datasetId}`, "PATCH", { ...payload, tagline: payload.tagline ?? null, description: payload.description ?? null });
      } else {
        const created = await api<{ dataset: { id: string; slug: string }; version: { id: string; versionNumber: number } }>("/api/datasets", "POST", payload);
        setIds({ datasetId: created.dataset.id, slug: created.dataset.slug, versionId: created.version.id, versionNumber: created.version.versionNumber });
        window.history.replaceState(null, "", `/studio/new?dataset=${created.dataset.id}`);
      }
      go("files");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function removeFile(id: string) {
    if (!ids) return;
    try {
      await api(`/api/datasets/versions/${ids.versionId}/files?fileId=${id}`, "DELETE");
      setFiles((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove file");
    }
  }

  function checkDatasheet() {
    const v = validateDatasheet(toDatasheet(sheet));
    if (!v.ok) return toast.error(v.error);
    go(visibility === "listed" ? "offers" : "seal");
  }

  function checkOffers() {
    if (!offers.length && !readPricing.enabled) return toast.error("Offer at least one licence or enable pay-per-read");
    if (offers.some((o) => o.template !== "RESEARCH" && o.priceApt <= 0)) return toast.error("Commercial and exclusive licences need a price");
    go("seal");
  }

  async function doSeal(offChain = false) {
    if (!ids) return;
    try {
      const r = await seal(ids.versionId, toDatasheet(sheet), { offChain });
      await api(`/api/datasets/${ids.datasetId}`, "PATCH", { ...(visibility === "listed" ? { offers, readPricing } : {}), action: "publish" });
      setResult(r);
      go("done");
      toast.success(visibility === "listed" ? "Sealed and listed" : "Sealed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sealing failed";
      toast.error(/reject|denied|cancel/i.test(msg) ? "Signature cancelled" : msg);
    }
  }

  const dataFiles = files.filter((f) => !f.isSample);
  const sealing = phase !== "idle" && phase !== "done";

  return (
    <div className="mx-auto max-w-[760px]">
      {step !== "done" && (
        <LiquidGlass radius={999} className="sticky top-[78px] z-30 mb-10 flex items-center gap-1 p-1.5">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-300",
                  i === index ? "bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]" : i < index ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    i < index ? "bg-[var(--green-solid)] text-white" : i === index ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-pressed)]"
                  )}
                >
                  {i < index ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{LABELS[s]}</span>
              </div>
            </div>
          ))}
        </LiquidGlass>
      )}

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: 24 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * dir }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === "basics" && (
            <section className="space-y-8">
              <header>
                <h1 className="display-lg">Tell buyers what this is.</h1>
                <p className="lede mt-2">A clear title and an honest description sell data better than anything else.</p>
              </header>
              <div className="space-y-5">
                <div>
                  <label className="field-label" htmlFor="title">Title</label>
                  <input id="title" className="field text-[17px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Egocentric kitchen tasks, 400 hours" maxLength={120} autoFocus />
                </div>
                <div>
                  <label className="field-label" htmlFor="tagline">One-line summary</label>
                  <input id="tagline" className="field" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Head-mounted 4K footage of real cooking, with hand-pose labels" maxLength={160} />
                </div>
                <div>
                  <p className="field-label">Modality</p>
                  <div className="flex flex-wrap gap-2">
                    {MODALITIES.map((m) => (
                      <button key={m.id} type="button" className="chip" aria-pressed={modality === m.id} onClick={() => setModality(m.id)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label" htmlFor="desc">Description</label>
                  <textarea id="desc" className="field" style={{ minHeight: 150 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's inside, how it's structured, label schema, intended uses…" maxLength={8000} />
                </div>
                <div>
                  <label className="field-label" htmlFor="tags">Tags</label>
                  <input id="tags" className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="egocentric, manipulation, hand-pose" />
                  <p className="field-hint">Comma separated, up to 12.</p>
                </div>
                <div>
                  <p className="field-label">Cover</p>
                  <CoverPicker value={cover?.url ?? null} onChange={(url, credit) => setCover({ url, credit })} />
                </div>
                <div>
                  <p className="field-label">Where should it live?</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      { v: "listed", icon: Globe, t: "On the marketplace", d: "Buyers can find, preview and license it." },
                      { v: "private", icon: Lock, t: "Private, compliance only", d: "Sealed for your own records. Never listed." },
                    ] as const).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setVisibility(o.v)}
                        aria-pressed={visibility === o.v}
                        className={cn(
                          "rounded-[22px] border p-4 text-left transition-all",
                          visibility === o.v ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        <o.icon className="h-5 w-5 text-[var(--accent-ink)]" />
                        <p className="mt-3 text-[15px] font-semibold">{o.t}</p>
                        <p className="text-[13px] text-[var(--text-secondary)]">{o.d}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={saveBasics} disabled={saving} className="btn-primary btn-lg">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {step === "files" && ids && (
            <section className="space-y-8">
              <header>
                <h1 className="display-lg">Add your files.</h1>
                <p className="lede mt-2">Version {ids.versionNumber}. Everything except samples is encrypted before it leaves this device.</p>
              </header>
              <FilesStep datasetId={ids.datasetId} versionId={ids.versionId} versionNumber={ids.versionNumber} existing={files} onUploaded={refreshFiles} onRemoveExisting={removeFile} />
              <div className="flex justify-between">
                <button type="button" onClick={() => go("basics")} className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button type="button" onClick={() => (dataFiles.length ? go("datasheet") : toast.error("Upload at least one data file"))} className="btn-primary btn-lg">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {step === "datasheet" && (
            <section className="space-y-8">
              <header>
                <h1 className="display-lg">Declare the source.</h1>
                <p className="lede mt-2">These answers are sealed with your files. Buyers rely on them for their own compliance.</p>
              </header>
              <DatasheetForm value={sheet} onChange={setSheet} />
              <div className="flex justify-between">
                <button type="button" onClick={() => go("files")} className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button type="button" onClick={checkDatasheet} className="btn-primary btn-lg">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {step === "offers" && (
            <section className="space-y-8">
              <header>
                <h1 className="display-lg">Set your terms.</h1>
                <p className="lede mt-2">Offer one licence or all three. Payments settle straight to your wallet in APT.</p>
              </header>
              <OffersEditor value={offers} onChange={setOffers} />
              <AgentPricingEditor value={readPricing} onChange={setReadPricing} />
              <div className="flex justify-between">
                <button type="button" onClick={() => go("datasheet")} className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button type="button" onClick={checkOffers} className="btn-primary btn-lg">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {step === "seal" && ids && (
            <section className="space-y-8">
              <header>
                <h1 className="display-lg">Seal it.</h1>
                <p className="lede mt-2">One signature anchors your manifest and datasheet on Aptos. After this, version {ids.versionNumber} can never change.</p>
              </header>
              <div className="surface divide-y divide-[var(--border-dim)]">
                {[
                  ["Dataset", title],
                  ["Files", `${dataFiles.length.toLocaleString()} encrypted · ${formatBytes(dataFiles.reduce((s, f) => s + f.sizeBytes, 0))}`],
                  ["Samples", `${files.length - dataFiles.length} public`],
                  ["Visibility", visibility === "listed" ? "Marketplace" : "Private (compliance only)"],
                  ...(visibility === "listed" ? [["Licences", offers.map((o) => `${o.template.toLowerCase()} ${o.priceApt ? `${o.priceApt} APT` : "free"}`).join(" · ") || "None"]] : []),
                  ...(visibility === "listed" ? [["Agents", readPricing.enabled ? `${readPricing.pricePerGbApt} APT per GB` : "Off"]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-[14px] text-[var(--text-secondary)]">{k}</span>
                    <span className="text-right text-[15px] font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 rounded-[20px] bg-[var(--bg-surface)] p-4 text-[14px] text-[var(--text-secondary)]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-ink)]" />
                <p>Your wallet will ask you to approve a small Aptos transaction. It records only hashes, never your data.</p>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={() => go(visibility === "listed" ? "offers" : "datasheet")} disabled={sealing} className="btn-secondary">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <button type="button" onClick={() => doSeal(false)} disabled={sealing} className="btn-primary btn-lg">
                    {sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    {phase === "hashing" ? "Computing seal…" : phase === "signing" ? "Approve in wallet…" : phase === "confirming" ? "Confirming on Aptos…" : "Seal on Aptos"}
                  </button>
                  <button type="button" onClick={() => doSeal(true)} disabled={sealing} className="btn-plain btn-sm">
                    Seal without anchoring
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === "done" && ids && result && (
            <section className="py-10 text-center">
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--green-dim)] text-[var(--green)]"
              >
                <CheckCircle2 className="h-10 w-10" />
              </motion.span>
              <h1 className="display-lg mt-6">Sealed.</h1>
              <p className="lede mx-auto mt-3 max-w-md">
                {visibility === "listed" ? "Your dataset is live on the marketplace." : "Your dataset is sealed and ready to cite in compliance records."}
              </p>
              <p className="mono mx-auto mt-5 max-w-md break-all rounded-2xl bg-[var(--bg-surface)] px-4 py-3 text-[12px]">seal {result.sealHash}</p>
              <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
                {visibility === "listed" && (
                  <Link href={`/datasets/${ids.slug}`} className="btn-primary">
                    View listing
                  </Link>
                )}
                <Link href={`/proof/${ids.versionId}`} className="btn-secondary">
                  View proof
                </Link>
                <Link href={`/studio/${ids.datasetId}`} className="btn-secondary">
                  Manage
                </Link>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
