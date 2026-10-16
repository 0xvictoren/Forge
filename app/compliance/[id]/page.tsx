import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/require-page-user";
import { AppFrame } from "@/components/shell/app-frame";
import { BackLink } from "@/components/shell/site-nav";
import { ProjectEditor, type Source } from "@/components/compliance/project-editor";
import { listAttachableSources } from "@/lib/datasets/compliance-server";
import { LICENSE_INFO, isLicenseKind } from "@/lib/datasets/licenses";

export const metadata: Metadata = { title: "Compliance record" };
export const dynamic = "force-dynamic";

export default async function ComplianceProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{24}$/i.test(id)) notFound();
  const user = await requirePageUser(`/compliance/${id}`);
  const project = await prisma.complianceProject.findUnique({ where: { id } });
  if (!project || project.ownerId !== user.id) notFound();
  const { licenses, ownVersions } = await listAttachableSources(user.id);

  const sources: Source[] = [
    ...licenses.map((l) => ({
      id: l.id,
      kind: "license" as const,
      title: l.dataset.title,
      subtitle: `${isLicenseKind(l.template) ? LICENSE_INFO[l.template].name : l.template} licence · v${l.version.versionNumber}`,
      sizeBytes: l.version.totalBytes,
      anchored: !!l.version.anchorTxHash,
    })),
    ...ownVersions.map((v) => ({
      id: v.id,
      kind: "own" as const,
      title: v.dataset.title,
      subtitle: `v${v.versionNumber} · ${v.anchorTxHash ? "anchored" : "sealed offchain"}`,
      sizeBytes: v.totalBytes,
      anchored: !!v.anchorTxHash,
    })),
  ];

  return (
    <AppFrame wide>
      <BackLink href="/compliance">Compliance</BackLink>
      <h1 className="display-lg mt-4 mb-10">{project.name}</h1>
      <ProjectEditor
        project={{
          id: project.id,
          name: project.name,
          modelName: project.modelName,
          providerName: project.providerName,
          purpose: project.purpose,
          licenseIds: project.licenseIds,
          datasetVersionIds: project.datasetVersionIds,
        }}
        sources={sources}
      />
    </AppFrame>
  );
}
