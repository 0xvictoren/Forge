import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { LandingHero } from "@/components/landing/landing-hero";
import { ReferralTracker } from "@/components/v2/referral-tracker";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import Link from "next/link";
import { UNSPLASH_FALLBACKS } from "@/lib/unsplash";

export default async function PublicHome() {
  // Dynamically fetch relevant images using the Unsplash key for better relevance and reliability
  const { searchUnsplashImages } = await import("@/lib/unsplash");

  const [pdfImgs, videoImgs, audioImgs, designImgs, codeImgs, packImgs] = await Promise.all([
    searchUnsplashImages("professional documents pdf guides on desk", 1),
    searchUnsplashImages("video production course filming studio", 1),
    searchUnsplashImages("music production studio headphones audio", 1),
    searchUnsplashImages("graphic design system workspace", 1),
    searchUnsplashImages("programming code template laptop screen", 1),
    searchUnsplashImages("digital product creator kit bundle mockup", 1),
  ]);

  const fileImages = {
    pdf: pdfImgs[0] || UNSPLASH_FALLBACKS.pdf,
    video: videoImgs[0] || UNSPLASH_FALLBACKS.video,
    audio: audioImgs[0] || UNSPLASH_FALLBACKS.audio,
    design: designImgs[0] || UNSPLASH_FALLBACKS.design,
    code: codeImgs[0] || UNSPLASH_FALLBACKS.code,
    pack: packImgs[0] || UNSPLASH_FALLBACKS.pack,
  };

  const portraits = [
    UNSPLASH_FALLBACKS.portrait1,
    UNSPLASH_FALLBACKS.portrait2,
    UNSPLASH_FALLBACKS.portrait3,
  ];

  return (
    <PageShell showSearch={false}>
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>

      <LandingHero />

      {/* How it works - clean, visual, benefit driven (Lemon Squeezy style) */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="label-caps">Three steps</div>
          <h2 className="mt-3 font-serif text-4xl tracking-tight text-[var(--text-primary)] md:text-5xl">
            Upload. Gate. Get paid.
          </h2>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            No accounts. No middlemen. Just your wallet and Shelby-secured files.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Upload any file",
              desc: "PDFs, video courses, design packs, audio, code, templates — stored permanently on Shelby.",
            },
            {
              step: "02",
              title: "Set access & price",
              desc: "Create BurnLinks, publish to Explore, organize into Vaults or Bundles. Price in APT.",
            },
            {
              step: "03",
              title: "Earn instantly",
              desc: "Buyers pay with wallet. You receive APT minus 2%. They get a certificate of ownership.",
            },
          ].map((item, i) => (
            <div key={i} className="card group p-8 transition hover:-translate-y-px hover:shadow-md">
              <div className="font-mono text-xs font-semibold tracking-[2px] text-[var(--brand)]">{item.step}</div>
              <h3 className="mt-4 font-serif text-2xl tracking-tight">{item.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* File types supported - visual grid with real imagery */}
      <section className="bg-[var(--bg-surface)] py-20 lg:py-24 border-t border-[var(--border-dim)]">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="label-caps">Any format. Real ownership.</div>
              <h2 className="mt-3 font-serif text-4xl tracking-tight">Sell what you actually make.</h2>
            </div>
            <Link href="/explore" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              Browse all assets →
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Documents & Guides", img: fileImages.pdf, type: "PDF" },
              { label: "Video Courses", img: fileImages.video, type: "VIDEO" },
              { label: "Audio & Music", img: fileImages.audio, type: "AUDIO" },
              { label: "Design Systems", img: fileImages.design, type: "PACK" },
              { label: "Code & Templates", img: fileImages.code, type: "CODE" },
              { label: "Creator Kits", img: fileImages.pack, type: "BUNDLE" },
            ].map((item, idx) => (
              <div key={idx} className="group relative overflow-hidden rounded-2xl border border-[var(--border-dim)] bg-[var(--bg-elevated)]">
                <div className="aspect-[16/10] overflow-hidden">
                  <img 
                    src={item.img} 
                    alt={item.label} 
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" 
                  />
                </div>
                <div className="p-5">
                  <div className="text-xs uppercase tracking-[1px] text-[var(--brand)]">{item.type}</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creator & Client split - two columns like premium SaaS */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-12 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-10">
            <div className="label-caps">For creators</div>
            <h3 className="mt-3 font-serif text-3xl tracking-tight">Own your distribution.</h3>
            <ul className="mt-6 space-y-3 text-[15px] text-[var(--text-secondary)]">
              <li className="flex gap-3">• Upload once to Shelby. Share gated links or list publicly.</li>
              <li className="flex gap-3">• Create Bundles, Vaults, and recurring Subscriptions.</li>
              <li className="flex gap-3">• Get paid directly in APT. Every buyer receives a verifiable Certificate.</li>
              <li className="flex gap-3">• 2% platform fee. Transparent on-chain attribution.</li>
            </ul>
            <Link href="/upload" className="btn-primary mt-8 inline-flex">Start uploading</Link>
          </div>

          <div className="card p-10">
            <div className="label-caps">For clients & collectors</div>
            <h3 className="mt-3 font-serif text-3xl tracking-tight">Buy with proof.</h3>
            <ul className="mt-6 space-y-3 text-[15px] text-[var(--text-secondary)]">
              <li className="flex gap-3">• Discover assets without creator profiles getting in the way.</li>
              <li className="flex gap-3">• Pay once with your Aptos wallet. Instant access in your Library.</li>
              <li className="flex gap-3">• Download anytime. Own a permanent Certificate of Ownership.</li>
              <li className="flex gap-3">• Support creators you believe in — directly and fairly.</li>
            </ul>
            <Link href="/explore" className="btn-primary mt-8 inline-flex">Explore assets</Link>
          </div>
        </div>
      </section>

      {/* Social proof / Testimonials with real portraits */}
      <section className="bg-[var(--bg-elevated)] py-20 lg:py-24 border-y border-[var(--border-dim)]">
        <div className="mx-auto max-w-5xl px-6 lg:px-12">
          <div className="text-center">
            <div className="label-caps">Real creators. Real results.</div>
            <h2 className="mt-3 font-serif text-3xl tracking-tight">People are already building on Forge.</h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                quote: "I sold my entire design system in a bundle. Buyers love the certificate. Payout was instant.",
                name: "Maya Chen",
                role: "Brand designer",
                img: portraits[0],
              },
              {
                quote: "BurnLinks let me gate my course modules perfectly. No more leaked Google Drives.",
                name: "Marcus Rivera",
                role: "Course creator",
                img: portraits[1],
              },
              {
                quote: "My music sample packs now feel legitimate. Clients get ownership proof and I get paid in APT.",
                name: "Lila Voss",
                role: "Music producer",
                img: portraits[2],
              },
            ].map((t, i) => (
              <div key={i} className="card p-7">
                <div className="flex items-center gap-4">
                  <img src={t.img} alt={t.name} className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--border-dim)]" />
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t.role}</div>
                  </div>
                </div>
                <p className="mt-6 text-[15px] leading-relaxed text-[var(--text-secondary)]">“{t.quote}”</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist + Final CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
        <h2 className="font-serif text-4xl tracking-tight md:text-5xl">Ready to own your creative work?</h2>
        <p className="mt-4 text-lg text-[var(--text-secondary)]">
          Connect your wallet. Upload your first asset. Start getting paid in minutes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/upload" className="btn-brand px-8 py-3.5 text-base">Upload your first asset</Link>
          <Link href="/explore" className="btn-ghost px-8 py-3.5 text-base">Explore what&apos;s selling</Link>
        </div>

        <div className="mt-14 border-t border-[var(--border-dim)] pt-12">
          <div className="label-caps">Stay in the loop</div>
          <p className="mt-2 text-[var(--text-secondary)]">
            Get notified about new features, creator tools, and marketplace updates.
          </p>
          <div className="mt-5">
            <WaitlistForm />
          </div>
        </div>

        <p className="mt-8 text-xs text-[var(--text-muted)]">No password. Just your Aptos wallet to create and sell.</p>
      </section>
    </PageShell>
  );
}
