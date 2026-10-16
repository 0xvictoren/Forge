"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GlassSwitch } from "@/components/glass/glass-switch";
import { LICENSE_INFO, LICENSE_TEMPLATES, type LicenseOffer, type LicenseTemplate } from "@/lib/datasets/licenses";

export function OffersEditor({ value, onChange }: { value: LicenseOffer[]; onChange: (next: LicenseOffer[]) => void }) {
  const get = (t: LicenseTemplate) => value.find((o) => o.template === t);
  const toggle = (t: LicenseTemplate, on: boolean) =>
    onChange(on ? [...value, { template: t, priceApt: t === "RESEARCH" ? 0 : t === "EXCLUSIVE" ? 100 : 10 }] : value.filter((o) => o.template !== t));
  const price = (t: LicenseTemplate, p: number) => onChange(value.map((o) => (o.template === t ? { ...o, priceApt: p } : o)));

  return (
    <div className="space-y-3">
      {LICENSE_TEMPLATES.map((t) => {
        const info = LICENSE_INFO[t];
        const offer = get(t);
        return (
          <div key={t} className="rounded-[22px] border border-[var(--border-default)] p-5 transition-colors" style={offer ? { borderColor: "var(--accent-border)" } : undefined}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[16px] font-semibold">{info.name}</p>
                <p className="text-[14px] text-[var(--text-secondary)]">{info.tagline}</p>
              </div>
              <GlassSwitch checked={!!offer} onChange={(on) => toggle(t, on)} label={`Offer ${info.name} licence`} />
            </div>
            <AnimatePresence initial={false}>
              {offer && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-3 pt-4">
                    <label className="text-[14px] text-[var(--text-secondary)]" htmlFor={`price-${t}`}>
                      Price
                    </label>
                    <div className="relative w-44">
                      <input
                        id={`price-${t}`}
                        type="number"
                        min={0}
                        step="0.01"
                        className="field pr-14 tabular"
                        value={offer.priceApt}
                        onChange={(e) => price(t, Math.max(0, Number(e.target.value) || 0))}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[var(--text-muted)]">APT</span>
                    </div>
                    {t === "RESEARCH" && offer.priceApt === 0 && <span className="badge badge-free">Free</span>}
                    {t !== "RESEARCH" && offer.priceApt <= 0 && <span className="text-[12px] text-[var(--red)]">Needs a price</span>}
                  </div>
                  {offer.priceApt > 0 && (
                    <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                      You receive {(offer.priceApt * 0.95).toLocaleString(undefined, { maximumFractionDigits: 6 })} APT after the 5% platform fee.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
