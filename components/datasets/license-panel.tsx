"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Check, CheckCircle2, Loader2, Lock, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { LICENSE_INFO, type LicenseOffer, type LicenseTemplate } from "@/lib/datasets/licenses";
import { requestPaymentIntent } from "@/lib/client-payment-intent";
import { useForgePurchase } from "@/lib/use-forge-purchase";
import { useEnsureSession } from "@/components/shell/use-authed-navigate";
import { cn } from "@/lib/utils";

type Phase = "idle" | "intent" | "sign" | "verify" | "done";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  intent: "Preparing terms…",
  sign: "Confirm in your wallet…",
  verify: "Verifying settlement on Aptos…",
  done: "Licensed",
};

export function LicensePanel({
  datasetId,
  datasetSlug,
  offers,
  isOwner,
  heldTemplates,
  available,
  agentOnly = false,
}: {
  datasetId: string;
  datasetSlug: string;
  offers: LicenseOffer[];
  isOwner: boolean;
  heldTemplates: LicenseTemplate[];
  available: boolean;
  agentOnly?: boolean;
}) {
  const [selected, setSelected] = useState<LicenseTemplate | null>(offers.find((o) => o.template === "COMMERCIAL")?.template ?? offers[0]?.template ?? null);
  const [orgName, setOrgName] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [certificate, setCertificate] = useState<string | null>(null);
  const { settlePurchase } = useForgePurchase();
  const ensureSession = useEnsureSession();

  const offer = offers.find((o) => o.template === selected);
  const busy = phase !== "idle" && phase !== "done";

  async function license() {
    if (!offer) return;
    if (!(await ensureSession())) return;
    if (!accepted) {
      toast.error("Please accept the licence terms");
      return;
    }
    try {
      let body: Record<string, unknown> = { template: offer.template, orgName: orgName || undefined, intendedUse: intendedUse || undefined };
      if (offer.priceApt > 0) {
        setPhase("intent");
        const intent = await requestPaymentIntent("DATASET", `${datasetId}:${offer.template}`);
        setPhase("sign");
        const txHash = await settlePurchase({ ...intent, expiresAt: String(intent.expiresAt) });
        setPhase("verify");
        body = { ...body, intentId: intent.id, txHash };
      } else {
        setPhase("verify");
      }
      const res = await fetch(`/api/datasets/${datasetId}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Licensing failed");
      setCertificate(data.license.certificateSlug);
      setPhase("done");
      toast.success("Licence issued");
    } catch (e) {
      setPhase("idle");
      const msg = e instanceof Error ? e.message : "Licensing failed";
      toast.error(/reject|denied|cancel/i.test(msg) ? "Transaction cancelled" : msg);
    }
  }

  if (isOwner) {
    return (
      <div className="surface p-6">
        <p className="title">You own this dataset</p>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Manage versions, pricing and licensees in Studio.</p>
        <Link href={`/studio/${datasetId}`} className="btn-primary mt-5 w-full">
          Open in Studio
        </Link>
      </div>
    );
  }

  if (phase === "done" && certificate) {
    return (
      <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="surface p-6 text-center">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--green-dim)] text-[var(--green)]"
        >
          <CheckCircle2 className="h-7 w-7" />
        </motion.span>
        <p className="title-lg mt-4">You&apos;re licensed.</p>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Your copy will be fingerprinted to this licence when you download it.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href={`/licenses?dataset=${datasetId}`} className="btn-primary">
            Go to downloads
          </Link>
          <Link href={`/license/${certificate}`} className="btn-secondary">
            View certificate
          </Link>
        </div>
      </motion.div>
    );
  }

  if (!offers.length || !available) {
    return (
      <div className="surface p-6">
        <p className="title">{agentOnly ? "Agents only" : "Not available"}</p>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          {agentOnly ? "This dataset is licensed pay-per-read to AI agents. See below." : "This dataset isn’t being licensed right now."}
        </p>
      </div>
    );
  }

  return (
    <div className="surface p-5">
      <p className="px-1 text-[13px] font-semibold text-[var(--text-secondary)]">Choose a licence</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Licence type">
        {offers.map((o) => {
          const info = LICENSE_INFO[o.template];
          const held = heldTemplates.includes(o.template);
          const active = selected === o.template;
          return (
            <button
              key={o.template}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(o.template)}
              className={cn(
                "relative w-full rounded-[20px] border p-4 text-left transition-all duration-300",
                active ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-semibold">{info.name}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{info.tagline}</p>
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-semibold tabular">{o.priceApt === 0 ? "Free" : `${o.priceApt.toLocaleString(undefined, { maximumFractionDigits: 4 })} APT`}</p>
                  {held && <span className="badge badge-free mt-1">Held</span>}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {active && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-3">
                      {info.grants.map((g) => (
                        <li key={g} className="flex items-start gap-2 text-[13px]">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--green)]" /> {g}
                        </li>
                      ))}
                      {info.restrictions.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r}
                        </li>
                      ))}
                    </div>
                  </motion.ul>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <label className="field-label" htmlFor="org">
            Organisation <span className="font-normal text-[var(--text-muted)]">(shown on your certificate)</span>
          </label>
          <input id="org" className="field" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Acme Robotics Ltd" maxLength={160} />
        </div>
        <div>
          <label className="field-label" htmlFor="use">
            Intended use <span className="font-normal text-[var(--text-muted)]">(optional)</span>
          </label>
          <input id="use" className="field" value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)} placeholder="Fine-tuning a grasping policy" maxLength={1000} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--bg-hover)] p-3 text-[13px]">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span className="text-[var(--text-secondary)]">
            I accept the {offer ? LICENSE_INFO[offer.template].name : ""} licence. I understand my copy is fingerprinted and traceable to this licence.
          </span>
        </label>
      </div>

      <button type="button" onClick={license} disabled={!offer || busy} className="btn-primary btn-lg mt-5 w-full">
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {PHASE_LABEL[phase]}
          </>
        ) : (
          <>
            <ScrollText className="h-4 w-4" />
            {offer?.priceApt ? `License for ${offer.priceApt.toLocaleString(undefined, { maximumFractionDigits: 4 })} APT` : "Get free research licence"}
          </>
        )}
      </button>
      <p className="caption mt-3 text-center">Settles on Aptos · 5% platform fee · Terms hashed onchain</p>
    </div>
  );
}
