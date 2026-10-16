"use client";

import { GlassSwitch } from "@/components/glass/glass-switch";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, type Datasheet, type SourceType } from "@/lib/datasets/manifest";
import { cn } from "@/lib/utils";

export type DatasheetDraft = Omit<Datasheet, "schema" | "geographies" | "languages" | "modalities"> & {
  geographies: string;
  languages: string;
  modalities: string;
};

export const EMPTY_DATASHEET: DatasheetDraft = {
  sourceType: "SELF_COLLECTED",
  sourceDescription: "",
  collectionStart: "",
  collectionEnd: "",
  geographies: "",
  languages: "",
  modalities: "",
  containsPersonalData: false,
  consentBasis: "",
  rightsStatement: "",
  respectsTdmOptOut: true,
  processingSteps: "",
  knownLimitations: "",
  contactEmail: "",
};

export function toDatasheet(d: DatasheetDraft): Partial<Datasheet> {
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  return { ...d, geographies: list(d.geographies), languages: list(d.languages), modalities: list(d.modalities) };
}

export function DatasheetForm({ value, onChange }: { value: DatasheetDraft; onChange: (next: DatasheetDraft) => void }) {
  const set = <K extends keyof DatasheetDraft>(k: K, v: DatasheetDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-7">
      <div>
        <p className="field-label">Where did this data come from?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SOURCE_TYPES.map((t: SourceType) => (
            <button
              key={t}
              type="button"
              onClick={() => set("sourceType", t)}
              aria-pressed={value.sourceType === t}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-[14px] font-medium transition-all",
                value.sourceType === t ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {SOURCE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="ds-desc">How was it made?</label>
        <textarea id="ds-desc" className="field" value={value.sourceDescription} onChange={(e) => set("sourceDescription", e.target.value)} placeholder="e.g. 400 hours recorded with head-mounted GoPros by 38 paid contributors in home kitchens, March to June 2026." />
      </div>

      <div>
        <label className="field-label" htmlFor="ds-rights">What rights do you hold?</label>
        <textarea id="ds-rights" className="field" style={{ minHeight: 88 }} value={value.rightsStatement} onChange={(e) => set("rightsStatement", e.target.value)} placeholder="e.g. All footage is owned by us under contributor agreements assigning copyright and AI-training rights." />
      </div>

      <div className="rounded-[20px] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium">Contains personal data</p>
            <p className="text-[13px] text-[var(--text-secondary)]">Faces, voices, names, or anything that identifies a person.</p>
          </div>
          <GlassSwitch checked={value.containsPersonalData} onChange={(v) => set("containsPersonalData", v)} label="Contains personal data" />
        </div>
        {value.containsPersonalData && (
          <div className="mt-4">
            <label className="field-label" htmlFor="ds-consent">Consent or legal basis</label>
            <input id="ds-consent" className="field" value={value.consentBasis} onChange={(e) => set("consentBasis", e.target.value)} placeholder="e.g. Signed model releases incl. AI training; GDPR Art. 6(1)(a)" />
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--border-dim)] pt-4">
          <div>
            <p className="text-[15px] font-medium">Respects text & data mining opt-outs</p>
            <p className="text-[13px] text-[var(--text-secondary)]">Nothing was collected from sources that reserved their rights.</p>
          </div>
          <GlassSwitch checked={value.respectsTdmOptOut} onChange={(v) => set("respectsTdmOptOut", v)} label="Respects TDM opt-outs" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="ds-start">Collection started</label>
          <input id="ds-start" type="date" className="field" value={value.collectionStart} onChange={(e) => set("collectionStart", e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="ds-end">Collection ended</label>
          <input id="ds-end" type="date" className="field" value={value.collectionEnd} onChange={(e) => set("collectionEnd", e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="ds-geo">Geographies</label>
          <input id="ds-geo" className="field" value={value.geographies} onChange={(e) => set("geographies", e.target.value)} placeholder="Nigeria, Kenya, UK" />
        </div>
        <div>
          <label className="field-label" htmlFor="ds-lang">Languages</label>
          <input id="ds-lang" className="field" value={value.languages} onChange={(e) => set("languages", e.target.value)} placeholder="English, Yoruba" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="ds-proc">Processing <span className="font-normal text-[var(--text-muted)]">(optional)</span></label>
        <input id="ds-proc" className="field" value={value.processingSteps} onChange={(e) => set("processingSteps", e.target.value)} placeholder="Faces blurred, audio normalised, 30 fps H.264" />
      </div>
      <div>
        <label className="field-label" htmlFor="ds-lim">Known limitations <span className="font-normal text-[var(--text-muted)]">(optional)</span></label>
        <input id="ds-lim" className="field" value={value.knownLimitations} onChange={(e) => set("knownLimitations", e.target.value)} placeholder="Daylight only; right-handed contributors" />
      </div>
    </div>
  );
}
