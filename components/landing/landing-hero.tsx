import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export function LandingHero() {
  return (
    <div className="min-h-[calc(100vh-52px)] bg-[#d4d4d4]">
      <section className="relative overflow-hidden bg-[#1a1a1a] px-6 pb-24 pt-28 text-white lg:px-12 lg:pb-32 lg:pt-36">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(220,84,41,0.15),_transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#dc5429]">
            Engineered by
          </p>
          <h1 className="mt-8 max-w-4xl font-serif text-4xl font-normal leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Web3 creator economy.
            <br />
            Built on Aptos + Shelby.
          </h1>
          <p className="mt-8 max-w-xl text-lg text-white/70">
            Upload once, get a BurnLink, get paid in APT — decentralized storage and on-chain
            payments for creators.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/upload" className="btn-primary inline-flex items-center gap-2">
              Share work
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/hire"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Discover creators
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="group relative overflow-hidden rounded-3xl bg-[#dc5429] p-10 text-white shadow-lg transition-transform hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Storage</p>
            <p className="mt-4 text-3xl font-bold">Shelby</p>
            <p className="mt-3 max-w-xs text-sm text-white/90">
              Every file, avatar, and invoice lives on Shelby blobs — not local or centralized storage.
            </p>
            <a
              href="https://explorer.shelby.xyz/shelbynet"
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a1a1a] text-white"
              aria-label="Shelby explorer"
            >
              <ArrowUpRight className="h-5 w-5" />
            </a>
          </div>
          <div className="group relative overflow-hidden rounded-3xl bg-white p-10 text-[#1a1a1a] shadow-lg transition-transform hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#dc5429]">Payments</p>
            <p className="mt-4 text-3xl font-bold">Aptos</p>
            <p className="mt-3 max-w-xs text-sm text-[var(--text-secondary)]">
              Wallet-native unlocks, verification, and creator payouts on ShelbyNet.
            </p>
            <Link
              href="/wallet"
              className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-lg bg-[#dc5429] text-white"
              aria-label="Wallet"
            >
              <ArrowUpRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <Logo iconClassName="h-12 w-12" />
          <p className="text-sm text-[var(--text-secondary)]">
            Ready to share gated work or find talent?
          </p>
          <Link href="/home" className="text-sm font-semibold text-[#dc5429] hover:underline">
            Browse latest BurnLinks →
          </Link>
        </div>
      </section>
    </div>
  );
}
