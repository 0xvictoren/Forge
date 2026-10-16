import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/require-page-user";
import { AppFrame } from "@/components/shell/app-frame";
import { NewDatasetWizard, type WizardInitial } from "@/components/studio/new-dataset-wizard";
import { parseOffers } from "@/lib/datasets/licenses";

export const metadata: Metadata = { title: "New dataset" };
export const dynamic = "force-dynamic";

export default async function NewDatasetPage({ searchParams }: { searchParams: Promise<{ dataset?: string }> }) {
  const { dataset: datasetId } = await searchParams;
  const user = await requirePageUser(datasetId ? `/studio/new?dataset=${datasetId}` : "/studio/new");

  let initial: WizardInitial | undefined;
  if (datasetId) {
    if (!/^[0-9a-f]{24}$/i.test(datasetId)) notFound();
    const d = await prisma.dataset.findUnique({
      where: { id: datasetId },
      include: { versions: { where: { status: "DRAFT" }, orderBy: { versionNumber: "desc" }, take: 1, include: { files: true } } },
    });
    if (!d || d.ownerId !== user.id) notFound();
    let draft = d.versions[0];
    if (!draft) {
      const last = await prisma.datasetVersion.findFirst({ where: { datasetId: d.id }, orderBy: { versionNumber: "desc" } });
      draft = await prisma.datasetVersion.create({
        data: { datasetId: d.id, versionNumber: (last?.versionNumber ?? 0) + 1 },
        include: { files: true },
      });
    }
    initial = {
      dataset: {
        id: d.id,
        slug: d.slug,
        title: d.title,
        tagline: d.tagline,
        description: d.description,
        modality: d.modality,
        tags: d.tags,
        coverUrl: d.coverUrl,
        visibility: d.visibility === "listed" || d.status === "DRAFT" ? d.visibility : "private",
        offers: parseOffers(d.offers),
      },
      version: { id: draft.id, versionNumber: draft.versionNumber },
      files: draft.files.map((f) => ({ id: f.id, path: f.path, sizeBytes: f.sizeBytes, isSample: f.isSample })),
    };
  }

  return (
    <AppFrame>
      <NewDatasetWizard initial={initial} />
    </AppFrame>
  );
}
