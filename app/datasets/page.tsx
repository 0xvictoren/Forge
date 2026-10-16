import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Database } from "lucide-react";
import { prisma } from "@/lib/db";
import { AppFrame, EmptyState, PageHeader } from "@/components/shell/app-frame";
import { BrowseControls } from "@/components/datasets/browse-controls";
import { DatasetCard } from "@/components/datasets/dataset-card";
import { Reveal } from "@/components/motion/reveal";
import { isModality } from "@/lib/datasets/modalities";
import { publicDataset } from "@/lib/datasets/server";

export const metadata: Metadata = { title: "Datasets" };
export const dynamic = "force-dynamic";

export default async function DatasetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; modality?: string; sort?: string }>;
}) {
  const { q, modality, sort } = await searchParams;
  const where: Prisma.DatasetWhereInput = { visibility: "listed", status: "PUBLISHED" };
  if (modality && isModality(modality)) where.modality = modality;
  const query = q?.trim().slice(0, 80);
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { tagline: { contains: query, mode: "insensitive" } },
      { tags: { has: query.toLowerCase() } },
    ];
  }

  let datasets: ReturnType<typeof publicDataset>[] = [];
  let failed = false;
  try {
    const rows = await prisma.dataset.findMany({
      where,
      take: 48,
      orderBy: sort === "popular" ? { licenseCount: "desc" } : { createdAt: "desc" },
      include: { owner: true, versions: { where: { status: "SEALED" } } },
    });
    datasets = rows.map(publicDataset);
  } catch (e) {
    console.error("[datasets] list failed", e);
    failed = true;
  }

  return (
    <AppFrame wide>
      <PageHeader
        eyebrow="Marketplace"
        title="Datasets"
        description="First-party training data, sealed on Aptos. Preview samples and verify every seal before you license."
        actions={
          <Link href="/studio/new" className="btn-primary">
            Sell a dataset
          </Link>
        }
      />
      <Suspense fallback={<div className="h-28" />}>
        <BrowseControls />
      </Suspense>
      <div className="mt-8">
        {failed ? (
          <EmptyState title="Couldn't load datasets" description="The database didn't respond. Refresh in a moment." />
        ) : datasets.length === 0 ? (
          <EmptyState
            icon={<Database className="h-6 w-6" />}
            title={query || modality ? "No matches" : "The shelves are empty, for now"}
            description={query || modality ? "Try a different search or category." : "Be the first to seal and list a dataset."}
            action={
              <Link href="/studio/new" className="btn-primary">
                Seal your first dataset
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {datasets.map((d, i) => (
              <Reveal key={d.id} delay={Math.min(i, 8) * 0.04} y={16}>
                <DatasetCard dataset={d} priority={i < 4} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
