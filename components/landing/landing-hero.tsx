import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Wallet, Shield, Zap } from "lucide-react";

export function LandingHero() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-[var(--brand-border)]">
        {/* Banner background */}
        <div className="absolute inset-0">
          <Image
            src="/banner.webp"
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
          <div className="relative py-16 lg:py-24">
            <div className="max-w-2xl">
              <div className="btn-pill-dark inline-flex items-center gap-2 !bg-[var(--charcoal)]/80 !text-[var(--text-cream)] backdrop-blur-sm">
                BUILT ON APTOS SHELBYNET
              </div>

              <h1 className="font-display mt-6 text-[52px] font-extrabold uppercase leading-[0.95] tracking-tight text-[var(--text-cream)] md:text-[64px] lg:text-[72px]">
                The Modern Way
                <br />
                To Sell Digital Work
              </h1>

              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-[var(--text-cream)]/90">
                A Web3 creator platform with wallet-native payments, Shelby-secured files,
                and instant ownership certificates. No signups, just connect and create.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/explore"
                  className="btn-pill-dark inline-flex items-center gap-2 !bg-[var(--charcoal)] px-8 py-3.5 text-[15px] shadow-lg"
                >
                  Explore Marketplace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--text-cream)] bg-transparent px-7 py-3.5 font-display text-[15px] font-bold uppercase tracking-wide text-[var(--text-cream)] transition hover:bg-[var(--text-cream)]/10"
                >
                  Start Selling
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-[var(--text-cream)]/75">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Wallet-native
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Certificates included
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Paid in APT
                </div>
              </div>
            </div>

            {/* Terminal preview card */}
            <div className="absolute bottom-8 right-6 hidden w-56 rounded-xl border border-[var(--brand)]/40 bg-[var(--bg-terminal)] p-3 shadow-glow lg:block xl:right-12">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--red)]" />
                <span className="h-2 w-2 rounded-full bg-[var(--tan)]" />
                <span className="h-2 w-2 rounded-full bg-[var(--green)]" />
              </div>
              <p className="stat-mono text-[10px] text-[var(--text-cream)]/70">FORGE_TERMINAL v2</p>
              <p className="stat-mono mt-1 text-xs text-[var(--green)]">+12.4 APT</p>
              <p className="stat-mono text-[10px] text-[var(--red)]">-0.02 fee</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border-dim)] bg-[var(--bg-surface)] py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-[var(--text-secondary)] lg:px-12">
          Creators sell{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            PDFs, video packs, design systems, code, music, and more
          </span>{" "}
, buyers get verifiable ownership with a single APT payment.
        </div>
      </section>
    </div>
  );
}