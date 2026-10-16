import { PageShell } from "@/components/layout/page-shell";
import Link from "next/link";
import { Upload, Lock, Wallet, BookOpen, Shield, Package } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: Upload,
    title: "Connect & upload",
    desc: "Connect your Aptos wallet on ShelbyNet. Upload any file, PDFs, video courses, design packs, audio, code. Files are stored permanently on Shelby with onchain registration.",
  },
  {
    step: "02",
    icon: Lock,
    title: "Set access & price",
    desc: "Choose your price in APT. Publish to Explore, create BurnLinks for gated sharing, or organize into Vaults and Bundles. Control who sees what and when.",
  },
  {
    step: "03",
    icon: Wallet,
    title: "Earn instantly",
    desc: "Buyers pay with their wallet. You receive the sale amount minus 5%. Every buyer gets a verifiable Certificate of Ownership. No middlemen, no payout delays.",
  },
];

const FEATURES = [
  { icon: BookOpen, title: "Library", desc: "All purchases in one place with download access and certificates." },
  { icon: Shield, title: "Certificates", desc: "Onchain proof of ownership for every paid asset." },
  { icon: Package, title: "Bundles & Vaults", desc: "Sell packs and organize gated collections for members." },
];

export default function HowItWorksPage() {
  return (
    <PageShell showSearch={false}>
      <div className="mx-auto max-w-5xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="label-caps">How it works</div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
            Upload. Gate. Get paid.
          </h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            No accounts. No middlemen. Just your wallet and Shelby-secured files.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="card p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-dim)]">
                    <Icon className="h-5 w-5 text-[var(--brand)]" />
                  </div>
                  <span className="font-mono text-xs font-semibold tracking-[2px] text-[var(--brand)]">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-2xl tracking-tight">{item.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <section className="mt-20">
          <h2 className="text-center font-serif text-3xl tracking-tight">For buyers & collectors</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card p-6 text-center">
                  <Icon className="mx-auto h-8 w-8 text-[var(--accent)]" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-16 rounded-3xl border border-[var(--border-dim)] bg-[var(--bg-elevated)] p-10 text-center">
          <h2 className="font-serif text-2xl tracking-tight">Ready to start?</h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            Connect your wallet and upload your first asset in minutes.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/upload" className="btn-brand px-8">Upload an asset</Link>
            <Link href="/explore" className="btn-ghost px-8">Browse marketplace</Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
