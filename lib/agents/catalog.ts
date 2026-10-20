import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isModality } from "@/lib/datasets/modalities";
import { isObjectId } from "@/lib/datasets/api";
import type { Datasheet } from "@/lib/datasets/manifest";
import { octasToAptString, parseReadPricing, quoteReadOctas } from "./pricing";
import { checkAvailability } from "@/lib/datasets/availability";

export async function listAgentDatasets(input: { q?: string | null; modality?: string | null; origin: string }) {
  const where: Prisma.DatasetWhereInput = { visibility: "listed", status: "PUBLISHED", latestVersionId: { not: null } };
  if (input.modality && isModality(input.modality)) where.modality = input.modality;
  const q = input.q?.trim().slice(0, 80);
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }];
  // Best-rated first, so agents land on data that others kept using.
  const rows = await prisma.dataset.findMany({ where, take: 100, orderBy: [{ rating: "desc" }, { createdAt: "desc" }], include: { versions: { where: { status: "SEALED" } } } });
  return rows
    .map((d) => ({ d, pricing: parseReadPricing(d.readPricing), v: d.versions.find((x) => x.id === d.latestVersionId) }))
    .filter((x) => x.pricing.enabled && x.v)
    .map(({ d, pricing, v }) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      tagline: d.tagline,
      modality: d.modality,
      tags: d.tags,
      rating: d.rating,
      originality: d.originalityScore,
      pricing: {
        pricePerGb: String(pricing.pricePerGbApt),
        minCharge: String(pricing.minChargeApt),
        fullDatasetPrice: octasToAptString(quoteReadOctas(v!.totalBytes, pricing)),
      },
      version: { id: v!.id, number: v!.versionNumber, sealHash: v!.sealHash, anchored: !!v!.anchorTxHash, fileCount: v!.fileCount, totalBytes: v!.totalBytes },
      manifest: `${input.origin}/api/agent/datasets/${d.id}`,
      proof: `${input.origin}/api/datasets/proof/${v!.id}`,
      page: `${input.origin}/datasets/${d.slug}`,
    }));
}

export async function getAgentDataset(idOrSlug: string, origin: string) {
  const dataset = await prisma.dataset.findFirst({
    where: isObjectId(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    include: { versions: { where: { status: "SEALED" }, include: { files: { where: { isSample: false }, orderBy: { path: "asc" } } } } },
  });
  const pricing = parseReadPricing(dataset?.readPricing);
  const version = dataset?.versions.find((v) => v.id === dataset.latestVersionId);
  if (!dataset || dataset.visibility !== "listed" || dataset.status !== "PUBLISHED" || !pricing.enabled || !version) return null;
  const datasheet = version.datasheet as unknown as Datasheet | null;
  const availability = await checkAvailability(version.id).catch(() => null);
  return {
    availability,
    dataset: { id: dataset.id, slug: dataset.slug, title: dataset.title, description: dataset.description, modality: dataset.modality, rating: dataset.rating, originality: dataset.originalityScore },
    licence: "METERED: issued automatically on your first paid read. Each read is fingerprinted to it.",
    pricing: { pricePerGb: String(pricing.pricePerGbApt), minCharge: String(pricing.minChargeApt), unit: "APT" },
    provenance: {
      versionId: version.id,
      version: version.versionNumber,
      sealHash: version.sealHash,
      manifestHash: version.manifestHash,
      anchorTxHash: version.anchorTxHash,
      proof: `${origin}/api/datasets/proof/${version.id}`,
      source: datasheet?.sourceType ?? null,
      containsPersonalData: datasheet?.containsPersonalData ?? null,
    },
    files: version.files.map((f) => ({
      id: f.id,
      path: f.path,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
      sha256: f.sha256,
      fullReadPrice: octasToAptString(quoteReadOctas(f.sizeBytes, pricing)),
      fullReadOctas: quoteReadOctas(f.sizeBytes, pricing).toString(),
      read: `${origin}/api/agent/files/${f.id}`,
      quote: `${origin}/api/agent/files/${f.id}/quote`,
    })),
  };
}

/** Licences held by an agent wallet, for attribution. */
export async function citeSources(wallet: string, origin: string) {
  const user = await prisma.user.findFirst({ where: { OR: [{ walletAddress: wallet }, { address: wallet }] } });
  if (!user) return [];
  const licenses = await prisma.datasetLicense.findMany({
    where: { buyerId: user.id },
    include: { dataset: true, version: true },
    orderBy: { createdAt: "desc" },
  });
  const reads = await prisma.agentRead.groupBy({ by: ["licenseId"], where: { buyerId: user.id }, _count: true, _sum: { bytes: true } });
  return licenses.map((l) => {
    const r = reads.find((x) => x.licenseId === l.id);
    return {
      dataset: l.dataset.title,
      licence: l.template,
      certificate: `${origin}/license/${l.certificateSlug}`,
      version: l.version.versionNumber,
      sealHash: l.version.sealHash,
      anchorTxHash: l.version.anchorTxHash,
      proof: `${origin}/proof/${l.versionId}`,
      paidReads: r?._count ?? 0,
      bytesRead: r?._sum.bytes ?? 0,
    };
  });
}
