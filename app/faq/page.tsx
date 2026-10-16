import { PageShell } from "@/components/layout/page-shell";
import Link from "next/link";

const FAQ_ITEMS = [
  {
    q: "What is Forge?",
    a: "Forge is a Web3 creator platform on Aptos ShelbyNet. Upload digital assets, set prices in APT, and sell directly to buyers with verifiable ownership certificates.",
  },
  {
    q: "Do I need an account or email?",
    a: "No. Connect your Aptos wallet (Petra, etc.) on ShelbyNet. Your wallet is your identity, no passwords or email sign-up required.",
  },
  {
    q: "What file types can I sell?",
    a: "PDFs, videos, audio, images, code, zip packs, templates, and more. Files are stored on Shelby with onchain blob registration.",
  },
  {
    q: "How do payments work?",
    a: "Buyers pay from their wallet. Creators receive payment minus a 5% platform fee. Every purchase issues a Certificate of Ownership.",
  },
  {
    q: "What is a BurnLink?",
    a: "A gated shareable link with optional time/view limits and paywalls. Great for one-off shares without listing on the public marketplace.",
  },
  {
    q: "What are Vaults and Bundles?",
    a: "Vaults organize assets into gated collections (courses, client deliverables, membership content). Bundles let you sell multiple assets at one price.",
  },
  {
    q: "Where do my purchases go?",
    a: "Everything you buy appears in your Library with download access and ownership certificates. Gated files require a valid purchase or subscription.",
  },
  {
    q: "Which network does Forge use?",
    a: "Forge runs on Aptos ShelbyNet (testnet). Connect your wallet to ShelbyNet to upload, buy, and sell.",
  },
];

export default function FaqPage() {
  return (
    <PageShell showSearch={false}>
      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="text-center">
          <div className="label-caps">Support</div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">Frequently asked questions</h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            Everything you need to know about buying, selling, and owning on Forge.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="card group p-6">
              <summary className="cursor-pointer list-none font-semibold tracking-tight marker:content-none">
                <span className="flex items-center justify-between">
                  {item.q}
                  <span className="text-[var(--text-muted)] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[var(--text-secondary)]">Still have questions?</p>
          <div className="mt-4 flex justify-center gap-4">
            <Link href="/how-it-works" className="btn-ghost">How Forge works</Link>
            <Link href="/explore" className="btn-brand">Explore marketplace</Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
