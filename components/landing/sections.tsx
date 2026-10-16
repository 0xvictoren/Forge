"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Check, Download, FileJson, Fingerprint, ShieldCheck } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FileHasher } from "@/components/datasets/file-hasher";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { useAuthedNavigate } from "@/components/shell/use-authed-navigate";
import { PHOTOS, photoCredit, photoUrl } from "@/lib/photos";

export function Promises() {
  const items = [
    {
      icon: BadgeCheck,
      tint: "var(--green)",
      bg: "var(--green-dim)",
      title: "Provenance you can verify.",
      body: "A seal on Aptos binds every file hash and the seller's declarations. Anyone can re-check it, no trust in Forge required.",
    },
    {
      icon: Fingerprint,
      tint: "var(--purple)",
      bg: "var(--purple-dim)",
      title: "A copy that names its owner.",
      body: "Deliveries carry per-licence canaries and invisible signatures, so leaks are traceable and sharing isn't worth the risk.",
    },
    {
      icon: ShieldCheck,
      tint: "var(--accent)",
      bg: "var(--accent-dim)",
      title: "Compliance in one click.",
      body: "Turn the datasets behind a model into a training-data record structured after the EU AI Office template.",
    },
  ];
  return (
    <section className="mx-auto max-w-[1080px] px-5 pb-10 pt-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="display-xl">
          Training data is a liability. <span className="text-[var(--text-muted)]">Unless you can prove where it came from.</span>
        </h2>
      </Reveal>
      <Stagger className="mt-16 grid gap-5 md:grid-cols-3">
        {items.map((it) => (
          <StaggerItem key={it.title}>
            <div className="surface surface-interactive h-full p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: it.bg, color: it.tint }}>
                <it.icon className="h-6 w-6" />
              </span>
              <h3 className="title-lg mt-6">{it.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">{it.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function CompliancePreview() {
  const credit = photoCredit(PHOTOS.research);
  return (
    <section className="mx-auto max-w-[1080px] px-5 py-28">
      <div className="relative overflow-hidden rounded-[36px] bg-[#0b0b0f] text-white">
        <Image src={photoUrl(PHOTOS.research, 1800, 70)} alt="" fill sizes="1080px" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/85 to-[#0b0b0f]/30" />
        <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.05fr_1fr] lg:p-16">
          <Reveal>
            <p className="text-[13px] font-semibold text-[#FF8C1A]">For model providers</p>
            <h2 className="display-lg mt-3">Your training-data record, already written.</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/70">
              Group the datasets behind a model, licensed on Forge or sealed from your own stores, and export a
              structured record: sources by category, licences, consent, opt-out handling, and every seal with its
              transaction.
            </p>
            <ul className="mt-6 space-y-2.5 text-[15px] text-white/80">
              {["Sections follow the EU AI Office public summary template", "Every source links to an onchain proof", "Export JSON or a print-ready report"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#30d158]" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12px] text-white/45">A drafting aid, not legal advice. Review with counsel before publishing.</p>
          </Reveal>
          <Reveal delay={0.12}>
            <LiquidGlass tone="dark" radius={28} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <FileJson className="h-4 w-4 text-[#FF8C1A]" /> Training data record
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">Example</span>
              </div>
              <div className="mt-5 space-y-3 text-[13px]">
                {[
                  ["2.2 Private datasets from third parties", "3 licensed"],
                  ["2.5 Synthetic data", "1 sealed"],
                  ["2.6 Other: collected by provider", "2 sealed"],
                ].map(([k, v], i) => (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 + i * 0.1, duration: 0.5 }}
                    className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3"
                  >
                    <span className="text-white/80">{k}</span>
                    <span className="font-medium text-white">{v}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[12px]">
                {[
                  ["Personal data", "Consented"],
                  ["TDM opt-outs", "Respected"],
                  ["Seals", "6 / 6 valid"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-white/[0.06] px-2 py-3">
                    <p className="text-white/50">{k}</p>
                    <p className="mt-1 font-semibold text-[#30d158]">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-[14px] font-medium text-[#1d1d1f]">
                <Download className="h-4 w-4" /> Export record
              </div>
            </LiquidGlass>
          </Reveal>
        </div>
        <a href={credit.href} target="_blank" rel="noreferrer" className="absolute bottom-3 right-5 text-[11px] text-white/35 hover:text-white/60">
          {credit.text}
        </a>
      </div>
    </section>
  );
}

export function VerifySection() {
  return (
    <section className="mx-auto max-w-[1080px] px-5 pb-28">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow">Don&apos;t trust. Verify.</p>
          <h2 className="display-lg mt-3">Check any file against its seal, right here.</h2>
          <p className="lede mt-4">
            Every sealed dataset publishes its manifest of SHA-256 hashes. Drop a file and your browser computes its
            fingerprint locally. On a dataset&apos;s proof page, it tells you instantly whether the file is exactly what
            was sealed.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="surface p-5">
            <FileHasher compact />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  const navigate = useAuthedNavigate();
  return (
    <section className="px-5 pb-28">
      <Reveal className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[36px] px-6 py-20 text-center text-white sm:px-12">
        <Image src={photoUrl(PHOTOS.heroAlt, 1800, 70)} alt="" fill sizes="1080px" className="object-cover" />
        <div className="absolute inset-0 bg-[#0b0806]/60" />
        <div className="relative">
          <h2 className="display-xl mx-auto max-w-[16ch]">Your data is worth more with proof.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[19px] text-white/75">Seal it, price it, and sell it to the teams who need it, in an afternoon.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => navigate("/studio/new")} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-[15px] text-[17px] font-medium text-[#1d1d1f] transition-transform active:scale-[0.97]">
              Start selling <ArrowRight className="h-4 w-4" />
            </button>
            <LiquidGlass radius={999} tone="dark" className="inline-flex">
              <button type="button" onClick={() => navigate("/datasets")} className="btn-glass px-7 py-[15px] text-[17px] text-white">
                Browse datasets
              </button>
            </LiquidGlass>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
