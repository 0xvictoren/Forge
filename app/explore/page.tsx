import Image from "next/image";
import { PageShell } from "@/components/layout/page-shell";
import { ExploreBrowser } from "@/components/v2/explore-browser";
import { t } from "@/lib/i18n/translations";

export default function ExplorePage() {
  return (
    <PageShell showSearch={false}>
      <section className="relative overflow-hidden border-b border-[var(--border-dim)]">
        <div className="absolute inset-0">
          <Image
            src="/bannerexplo.webp"
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 py-14 text-center lg:px-8 lg:py-16">
          <div className="label-caps text-[var(--text-cream)]">
            {t("en", "marketplace") || "Marketplace"}
          </div>
          <h1 className="font-display mt-3 text-5xl font-extrabold uppercase tracking-tight text-[var(--text-cream)] md:text-6xl">
            {t("en", "explore_digital_assets") || "Discover digital assets."}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-[var(--text-cream)]/90">
            {t("en", "templates_courses_packs") ||
              "High-quality templates, courses, packs, and vaults from creators on Aptos. Pay once. Own forever with a certificate."}
          </p>
        </div>
      </section>
      <ExploreBrowser />
    </PageShell>
  );
}