import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppFrame } from "@/components/shell/app-frame";
import { HomeHero } from "@/components/landing/home-hero";
import { Audiences, Closing, Originality, Questions, Steps, Trust } from "@/components/landing/home-sections";
import { DatasetCard } from "@/components/datasets/dataset-card";
import { ReferralTracker } from "@/components/v2/referral-tracker";
import { AuthRedirectNotice } from "@/components/auth/auth-redirect-notice";
import { prisma } from "@/lib/db";
import { publicDataset } from "@/lib/datasets/server";

export const revalidate = 300;

/** Best-rated live listings, so the page shows real data instead of stock photos. */
async function featured() {
  try {
    const rows = await prisma.dataset.findMany({
      where: { visibility: "listed", status: "PUBLISHED", latestVersionId: { not: null }, NOT: { tags: { has: "e2e" } } },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 3,
      include: { owner: true, versions: { where: { status: "SEALED" } } },
    });
    return rows.map(publicDataset);
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const datasets = await featured();
  return (
    <AppFrame bare>
      <Suspense fallback={null}>
        <ReferralTracker />
        <AuthRedirectNotice />
      </Suspense>
      <HomeHero />
      <Steps />
      <Originality />
      <Audiences />
      {datasets.length > 0 && (
        <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:pb-32">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">On Forge now</p>
              <h2 className="display-lg mt-2">Top-rated datasets</h2>
            </div>
            <Link href="/datasets" className="flex shrink-0 items-center gap-1 text-[15px] font-semibold text-[var(--accent-ink)] hover:underline">
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((d, i) => (
              <DatasetCard key={d.id} dataset={d} priority={i === 0} />
            ))}
          </div>
        </section>
      )}
      <Trust />
      <Questions />
      <Closing />
    </AppFrame>
  );
}
