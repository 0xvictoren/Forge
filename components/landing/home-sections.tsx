"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, BadgeCheck, Bot, Building2, Fingerprint, Mail, Plus, ShieldCheck, Sparkles, Star, Upload, Wallet } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { ScoreRing } from "@/components/studio/originality-card";
import { useAuthedNavigate } from "@/components/shell/use-authed-navigate";
import { cn } from "@/lib/utils";

function SectionHead({ eyebrow, title, sub, className }: { eyebrow: string; title: React.ReactNode; sub?: string; className?: string }) {
  return (
    <Reveal className={cn("mx-auto max-w-[44rem] text-center", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-xl mt-3">{title}</h2>
      {sub && <p className="lede mx-auto mt-5 max-w-[36rem]">{sub}</p>}
    </Reveal>
  );
}

// ─── 1. Three steps ──────────────────────────────────────────────────────────

export function Steps() {
  const steps = [
    { icon: Mail, title: "Sign in with email", body: "We create a secure account for you. No wallet, no seed phrase, no crypto to buy." },
    { icon: Upload, title: "Drop in your files", body: "Forge checks they're original, then encrypts them on your device before anything is stored." },
    { icon: Wallet, title: "Get paid when it's used", body: "Teams buy licences and AI agents pay per read. You keep 95%, paid out automatically." },
  ];
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-24 sm:py-32">
      <SectionHead eyebrow="How it works" title="Three steps. That's it." />
      <Stagger className="mt-16 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <StaggerItem key={s.title}>
            <div className="h-full rounded-[32px] bg-[var(--bg-surface)] p-8">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--accent)] shadow-[var(--shadow-sm)]">
                  <s.icon className="h-[22px] w-[22px]" />
                </span>
                <span className="text-[44px] font-bold leading-none tracking-[-0.04em] text-[var(--bg-inset)]">{i + 1}</span>
              </div>
              <h3 className="title-lg mt-8">{s.title}</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-[var(--text-secondary)]">{s.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

// ─── 2. Originality ──────────────────────────────────────────────────────────

const EXAMPLES = {
  yours: {
    label: "Your own recordings",
    score: 8.7,
    passed: true,
    parts: [
      ["Unique", 9.6],
      ["Added value", 8.1],
      ["No repeats", 10],
      ["Described", 7.4],
    ] as [string, number][],
    note: "Listed. Buyers see this score on your page.",
  },
  scraped: {
    label: "Articles copied from the web",
    score: 1.4,
    passed: false,
    parts: [
      ["Unique", 0.8],
      ["Added value", 2.2],
      ["No repeats", 6.5],
      ["Described", 3],
    ] as [string, number][],
    note: "Turned back, with tips on what to change.",
  },
};

export function Originality() {
  const [pick, setPick] = useState<keyof typeof EXAMPLES>("yours");
  const ex = EXAMPLES[pick];
  return (
    <section className="bg-[var(--bg-elevated)] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1180px] items-center gap-14 px-5 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow">Originality check</p>
          <h2 className="display-xl mt-3">
            Only original data
            <br />
            gets in.
          </h2>
          <p className="lede mt-5 max-w-[30rem]">
            Every upload is scored out of 10 against everything already on Forge. Scraped pages, re-uploads and copies score low and can&apos;t be
            listed. Real work you collected, labelled or created scores high.
          </p>
          <ul className="mt-8 space-y-3 text-[16px] text-[var(--text-secondary)]">
            {["Below 5 out of 10, the upload is refused with clear tips", "Your files are compared by fingerprint, never kept in the clear", "Ratings keep moving as buyers and agents use your data"].map((t) => (
              <li key={t} className="flex gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green)]" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-[36px] bg-[var(--bg-surface)] p-6 sm:p-8">
            <div className="flex rounded-full bg-[var(--bg-pressed)] p-1">
              {(Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPick(k)}
                  className={cn("relative flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors", pick === k ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]")}
                >
                  {pick === k && <motion.span layoutId="orig-pill" className="absolute inset-0 rounded-full bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{EXAMPLES[k].label}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={pick} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row">
                  <ScoreRing score={ex.score} passed={ex.passed} size={140} />
                  <div className="w-full flex-1 space-y-3">
                    {ex.parts.map(([label, v], i) => (
                      <div key={label}>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[var(--text-secondary)]">{label}</span>
                          <span className="font-semibold tabular">{v.toFixed(1)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-pressed)]">
                          <motion.div
                            className={cn("h-full rounded-full", v >= 5 ? "bg-[var(--green-solid)]" : "bg-[var(--orange-solid)]")}
                            initial={{ width: 0 }}
                            animate={{ width: `${v * 10}%` }}
                            transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className={cn("mt-7 flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-medium", ex.passed ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--orange-dim)] text-[var(--orange)]")}>
                  <Sparkles className="h-4 w-4" /> {ex.note}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 3. Who it's for ─────────────────────────────────────────────────────────

export function Audiences() {
  const tiles = [
    {
      icon: Building2,
      title: "For teams training models",
      body: "License data with rights you can show. Every dataset carries a seal, a datasheet and a licence certificate, and your training-data record writes itself.",
      href: "/datasets",
      cta: "Browse datasets",
      dark: false,
    },
    {
      icon: Bot,
      title: "For AI agents",
      body: "Agents search Forge, check provenance and pay per read through one funded budget. Connect over MCP in a minute, best-rated data first.",
      href: "/agents",
      cta: "Connect an agent",
      dark: true,
    },
  ];
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-24 sm:py-32">
      <SectionHead eyebrow="Who buys" title="People and their agents." sub="Two ways in, one catalogue of data with proof attached." />
      <div className="mt-16 grid gap-4 lg:grid-cols-2">
        {tiles.map((t, i) => (
          <Reveal key={t.title} delay={i * 0.08}>
            <Link
              href={t.href}
              className={cn(
                "group flex h-full flex-col rounded-[36px] p-8 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 sm:p-10",
                t.dark ? "bg-[#1d1d1f] text-white" : "bg-[var(--bg-surface)]"
              )}
            >
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", t.dark ? "bg-white/10 text-[#FF8C1A]" : "bg-[var(--bg-elevated)] text-[var(--accent)] shadow-[var(--shadow-sm)]")}>
                <t.icon className="h-6 w-6" />
              </span>
              <h3 className="display-lg mt-10">{t.title}</h3>
              <p className={cn("mt-4 max-w-[30rem] text-[17px] leading-relaxed", t.dark ? "text-white/65" : "text-[var(--text-secondary)]")}>{t.body}</p>
              <span className={cn("mt-auto flex items-center gap-1.5 pt-10 text-[16px] font-semibold", t.dark ? "text-[#FF8C1A]" : "text-[var(--accent-ink)]")}>
                {t.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── 4. Trust ────────────────────────────────────────────────────────────────

export function Trust() {
  const items = [
    { icon: BadgeCheck, title: "Sealed onchain", body: "Each version's file hashes are anchored on Aptos. Anyone can check them." },
    { icon: ShieldCheck, title: "Encrypted storage", body: "Files are encrypted on your device and stored on Shelby. Only licence holders can open them." },
    { icon: Fingerprint, title: "Traceable copies", body: "Every delivery is fingerprinted to its buyer, so a leak points straight back to them." },
    { icon: Star, title: "Rated out of 10", body: "Scores blend originality with how buyers and agents actually use the data." },
  ];
  return (
    <section className="bg-[var(--bg-elevated)] py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5">
        <SectionHead eyebrow="Built on proof" title="Trust you can check." />
        <Stagger className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <StaggerItem key={it.title}>
              <it.icon className="h-7 w-7 text-[var(--accent)]" />
              <h3 className="title mt-5">{it.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">{it.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="mt-14 text-center">
          <Link href="/verify" className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-[var(--accent-ink)] hover:underline">
            Verify any file yourself <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 5. Questions ────────────────────────────────────────────────────────────

const FAQ = [
  ["Do I need a crypto wallet?", "No. Sign in with your email and Forge creates a secure account for you. Forge pays the network fees. If you already use an Aptos wallet, you can sign in with it instead."],
  ["What kind of data sells?", "Data nobody else has: recordings, photos and video you captured, labelled or annotated datasets, field notes, sensor logs, expert writing. Copied or scraped content won't pass the originality check."],
  ["How do I get paid?", "Buyers pay when they license a dataset, and agents pay for each read. You keep 95%. Payouts land in your Forge account automatically."],
  ["Can buyers share my files?", "Every copy is fingerprinted to the licence that downloaded it. If a file leaks, you can trace it to the buyer and revoke their access."],
] as const;

export function Questions() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-[760px] px-5 py-24 sm:py-32">
      <SectionHead eyebrow="Questions" title="Good to know." />
      <div className="mt-12 divide-y divide-[var(--border-dim)] border-y border-[var(--border-dim)]">
        {FAQ.map(([q, a], i) => (
          <div key={q}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left" aria-expanded={open === i}>
              <span className="text-[19px] font-semibold tracking-[-0.015em]">{q}</span>
              <Plus className={cn("h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform duration-300", open === i && "rotate-45")} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                  <p className="pb-6 pr-10 text-[16px] leading-relaxed text-[var(--text-secondary)]">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 6. Closing call to action ───────────────────────────────────────────────

export function Closing() {
  const navigate = useAuthedNavigate();
  return (
    <section className="px-5 pb-24 sm:pb-32">
      <Reveal className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[44px] bg-[#1d1d1f] px-6 py-20 text-center text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_100%,rgba(244,119,10,0.35),transparent)]" />
        <h2 className="display-xl relative mx-auto max-w-[16ch]">Bring something only you have.</h2>
        <p className="relative mx-auto mt-5 max-w-[30rem] text-[18px] leading-relaxed text-white/65">Set up in a minute with your email. Listing is free.</p>
        <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => navigate("/studio/new")} className="btn-primary btn-lg">
            Start selling <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => navigate("/datasets")} className="btn-lg rounded-full px-7 font-semibold text-white/85 transition-colors hover:text-white">
            Browse datasets
          </button>
        </div>
      </Reveal>
    </section>
  );
}
