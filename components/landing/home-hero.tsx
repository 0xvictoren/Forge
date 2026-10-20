"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, FileText, Lock, Mail, Sparkles } from "lucide-react";
import { useAuthedNavigate } from "@/components/shell/use-authed-navigate";
import { ScoreRing } from "@/components/studio/originality-card";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The four beats of selling on Forge, played on a loop in the hero card. */
const BEATS = ["upload", "check", "seal", "sold"] as const;
type Beat = (typeof BEATS)[number];

const FILES = ["market-interviews-01.m4a", "market-interviews-02.m4a", "transcripts-labelled.jsonl"];

function StoryCard() {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState<Beat>(reduce ? "sold" : "upload");

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setBeat((b) => BEATS[(BEATS.indexOf(b) + 1) % BEATS.length]), 2600);
    return () => clearInterval(t);
  }, [reduce]);

  const at = BEATS.indexOf(beat);
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute -inset-10 -z-10 rounded-[60px] bg-[radial-gradient(closest-side,rgba(244,119,10,0.22),transparent)] blur-2xl" />
      <div
        style={{ animationDelay: "0.25s" }}
        className="rise rounded-[32px] bg-[var(--bg-elevated)] p-5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.35),0_0_0_1px_var(--border-dim)] sm:p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[var(--text-muted)]">New dataset</p>
            <p className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em]">Lagos market interviews</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)]">
            <Mail className="h-3.5 w-3.5" /> ada@gmail.com
          </span>
        </div>

        <ul className="mt-5 space-y-2">
          {FILES.map((f, i) => (
            <li key={f} className="flex items-center gap-3 rounded-2xl bg-[var(--bg-surface)] px-3.5 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{f}</span>
              <motion.span
                key={`${beat}-${i}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 400, damping: 22 }}
              >
                {at >= 1 ? <Lock className="h-4 w-4 text-[var(--accent-ink)]" /> : <CheckCircle2 className="h-4 w-4 text-[var(--green)]" />}
              </motion.span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex min-h-[112px] items-center gap-5 rounded-[24px] border border-[var(--border-dim)] p-4">
          <ScoreRing key={at >= 1 ? "on" : "off"} score={at >= 1 ? 8.7 : 0} passed size={88} />
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={beat} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
                {beat === "upload" && (
                  <>
                    <p className="text-[15px] font-semibold">Uploading</p>
                    <p className="text-[13px] text-[var(--text-secondary)]">Encrypted on your device first.</p>
                  </>
                )}
                {beat === "check" && (
                  <>
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                      <Sparkles className="h-4 w-4 text-[var(--green)]" /> Original
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)]">Nothing like it on Forge. Labelled by you.</p>
                  </>
                )}
                {beat === "seal" && (
                  <>
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                      <BadgeCheck className="h-4 w-4 text-[var(--green)]" /> Sealed onchain
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)]">Proof of what you made, and when.</p>
                  </>
                )}
                {beat === "sold" && (
                  <>
                    <p className="text-[15px] font-semibold">Licensed 3 times today</p>
                    <p className="text-[13px] text-[var(--text-secondary)]">You keep 95% of every sale.</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 flex gap-1.5">
          {BEATS.map((b, i) => (
            <span key={b} className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-pressed)]">
              <motion.span className="block h-full rounded-full bg-[var(--accent)]" animate={{ width: i <= at ? "100%" : "0%" }} transition={{ duration: 0.5, ease: EASE }} />
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {beat === "sold" && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="glass glass-strong absolute -bottom-6 -right-2 flex items-center gap-3 rounded-[22px] px-4 py-3 sm:-right-10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--green-solid)] text-[15px] font-bold text-white">+</span>
            <div>
              <p className="text-[14px] font-semibold tabular">23.75 APT</p>
              <p className="text-[12px] text-[var(--text-secondary)]">Commercial licence · an AI lab</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HomeHero() {
  const navigate = useAuthedNavigate();
  const rise = (delay: number) => ({ style: { animationDelay: `${delay}s` } });

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(244,119,10,0.10),transparent)]" />
      <div className="mx-auto grid max-w-[1180px] items-center gap-16 px-5 pb-24 pt-32 sm:pt-40 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-32">
        <div className="text-center lg:text-left">
          <p style={rise(0).style} className="rise inline-flex items-center gap-2 rounded-full bg-[var(--accent-dim)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-ink)]">
            <Mail className="h-3.5 w-3.5" /> Sign up with just your email
          </p>
          <h1 style={rise(0.06).style} className="rise display-hero mt-6">
            Sell the data
            <br />
            <span className="text-[var(--accent)]">only you have.</span>
          </h1>
          <p style={rise(0.12).style} className="rise lede mx-auto mt-6 max-w-[33rem] lg:mx-0">
            Forge is where AI teams and their agents license original data from the people who made it. Every upload is checked for originality,
            sealed onchain and traceable to its buyer.
          </p>
          <div style={rise(0.18).style} className="rise mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button type="button" onClick={() => navigate("/studio/new")} className="btn-primary btn-lg w-full sm:w-auto">
              Start selling <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => navigate("/datasets")} className="btn-secondary btn-lg w-full sm:w-auto">
              Browse datasets
            </button>
          </div>
          <p style={rise(0.24).style} className="rise mt-5 text-[13px] text-[var(--text-muted)]">
            Free to list. No wallet or crypto needed. Forge pays the network fees.
          </p>
        </div>
        <StoryCard />
      </div>
    </section>
  );
}

