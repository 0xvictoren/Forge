"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { BadgeCheck, CloudUpload, FileCheck2, Fingerprint, KeyRound, Lock, ScrollText, Search, Wallet } from "lucide-react";
import { GlassSegmented } from "@/components/glass/glass-segmented";

type Role = "sell" | "license";

const STEPS: Record<Role, { icon: React.ElementType; title: string; body: string }[]> = {
  sell: [
    { icon: Lock, title: "Encrypt on your device", body: "Files are hashed and encrypted in your browser before they ever leave it. Shelby stores ciphertext only." },
    { icon: FileCheck2, title: "Describe the source", body: "A short datasheet: where the data came from, the rights you hold, consent, and known limits." },
    { icon: BadgeCheck, title: "Seal it on Aptos", body: "One signature anchors the manifest and datasheet hashes onchain. Change one byte and the seal breaks." },
    { icon: Wallet, title: "Set terms, get paid", body: "Offer Research, Commercial or Exclusive licences. Payment settles straight to your wallet." },
  ],
  license: [
    { icon: Search, title: "Find and verify", body: "Preview samples and check every seal independently, before you spend anything." },
    { icon: ScrollText, title: "License in one step", body: "The licence text is hashed into the payment, so the exact terms you accepted are provable forever." },
    { icon: Fingerprint, title: "Receive your copy", body: "Text files are fingerprinted for your licence; downloads and pipeline pulls are logged." },
    { icon: KeyRound, title: "Pull from your pipeline", body: "Mint a one-hour credential and stream files straight into training jobs. No shared links." },
  ],
};

export function HowItWorks() {
  const [role, setRole] = useState<Role>("sell");
  return (
    <section id="how" className="mx-auto max-w-[1080px] scroll-mt-24 px-5 py-28">
      <div className="text-center">
        <p className="eyebrow">How it works</p>
        <h2 className="display-xl mx-auto mt-3 max-w-[16ch]">Four steps. No middlemen.</h2>
        <div className="mt-8 flex justify-center">
          <GlassSegmented
            ariaLabel="Choose a role"
            value={role}
            onChange={setRole}
            className="w-[300px]"
            options={[
              { value: "sell", label: "I sell data", icon: <CloudUpload className="h-4 w-4" /> },
              { value: "license", label: "I license data", icon: <Search className="h-4 w-4" /> },
            ]}
          />
        </div>
      </div>

      <div className="relative mt-14">
        <AnimatePresence mode="wait">
          <motion.ol
            key={role}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {STEPS[role].map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="surface surface-interactive flex flex-col p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-dim)] text-[var(--accent-ink)]">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--text-muted)] tabular">0{i + 1}</span>
                </div>
                <h3 className="title mt-6">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">{step.body}</p>
              </motion.li>
            ))}
          </motion.ol>
        </AnimatePresence>
      </div>
    </section>
  );
}
