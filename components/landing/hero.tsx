"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { PHOTOS, photoCredit, photoUrl } from "@/lib/photos";
import { useAuthedNavigate } from "@/components/shell/use-authed-navigate";

const EASE = [0.22, 1, 0.36, 1] as const;

export function LandingHero() {
  const ref = useRef<HTMLElement>(null);
  const navigate = useAuthedNavigate();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.04, reduce ? 1.04 : 1.14]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const credit = photoCredit(PHOTOS.hero);

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#0b0806] text-white">
      <motion.div className="absolute inset-0 -z-10" style={{ y: imageY, scale: imageScale }}>
        <Image src={photoUrl(PHOTOS.hero, 2400, 82)} alt="" fill priority sizes="100vw" className="object-cover opacity-70" />
      </motion.div>
      {/* Brand glow over the photo, then a vignette into the page. */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_110%,rgba(244,119,10,0.45),transparent_60%)] mix-blend-screen" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(11,8,6,0.1),rgba(11,8,6,0.78)_70%,#0b0806)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[var(--bg-base)]" />

      <motion.div style={{ opacity: contentOpacity }} className="mx-auto w-full max-w-[1080px] px-5 pb-24 pt-32 text-center">
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
          className="display-hero mx-auto max-w-[11ch]"
        >
          Data that proves itself.
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1, ease: EASE }}
          className="mx-auto mt-6 max-w-[34rem] text-[clamp(17px,1.8vw,21px)] leading-[1.45] text-white/75"
        >
          The marketplace for AI training data. Every dataset is encrypted, sealed onchain, and fingerprinted for every buyer.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: EASE }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button type="button" onClick={() => navigate("/datasets")} className="btn-primary btn-lg">
            Browse datasets <ArrowRight className="h-4 w-4" />
          </button>
          <LiquidGlass radius={999} tone="dark" depth={14} scale={22} className="inline-flex">
            <button type="button" onClick={() => navigate("/studio/new")} className="btn-glass px-7 py-[15px] text-[17px] text-white">
              Sell your data
            </button>
          </LiquidGlass>
        </motion.div>
      </motion.div>

      <a href={credit.href} target="_blank" rel="noreferrer" className="absolute bottom-4 right-5 text-[11px] text-white/40 hover:text-white/70">
        {credit.text}
      </a>
    </section>
  );
}
