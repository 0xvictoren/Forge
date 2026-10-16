import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, NO_STORE, rateLimited, requireUser } from "@/lib/datasets/api";
import { decodeSignatures, detectFingerprintFormat, fingerprintContent, traceLeak } from "@/lib/datasets/fingerprint";
import { licenseCoversVersion, logDatasetAccess, readOriginalText } from "@/lib/datasets/server";

const schema = z.union([
  z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/i) }),
  z.object({ fileId: z.string().regex(/^[0-9a-f]{24}$/i), suspect: z.string().min(1).max(20_000_000) }),
  z.object({ suspect: z.string().min(1).max(20_000_000) }),
]);

/**
 * Seller-only leak tracing. Three strategies, strongest first:
 *  - exact sha256 of a delivered copy (from access logs)
 *  - invisible signature decoding (no original needed)
 *  - canary matching against regenerated per-licence canaries
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`dataset-trace:${auth.user.id}`, 6);
  if (limited) return limited;
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Dataset not found", 404);

  const dataset = await prisma.dataset.findUnique({ where: { id } });
  if (!dataset || dataset.ownerId !== auth.user.id) return jsonError("Dataset not found", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Paste the suspected content or a SHA-256");

  const licenses = await prisma.datasetLicense.findMany({
    where: { datasetId: id },
    include: { buyer: { select: { displayName: true, username: true, walletAddress: true } }, version: { select: { versionNumber: true } } },
    take: 500,
  });
  const describe = (licenseId: string) => {
    const l = licenses.find((x) => x.id === licenseId);
    if (!l) return null;
    return {
      licenseId: l.id,
      certificateSlug: l.certificateSlug,
      template: l.template,
      orgName: l.orgName,
      buyer: l.buyer.displayName || l.buyer.username || l.buyer.walletAddress,
      wallet: l.buyer.walletAddress,
      issuedAt: l.createdAt,
      status: l.status,
    };
  };

  await logDatasetAccess({ request, datasetId: id, userId: auth.user.id, action: "TRACE" });

  if ("sha256" in parsed.data) {
    const log = await prisma.datasetAccessLog.findFirst({
      where: { datasetId: id, deliveredSha256: parsed.data.sha256.toLowerCase() },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      { method: "sha256", matches: log?.licenseId ? [{ ...describe(log.licenseId), confidence: "conclusive", deliveredAt: log.createdAt }] : [] },
      { headers: NO_STORE }
    );
  }

  const suspect = parsed.data.suspect;
  const signatureMatches = [...decodeSignatures(suspect).entries()]
    .map(([fingerprintId, hits]) => {
      const l = licenses.find((x) => x.fingerprintId === fingerprintId);
      return l ? { ...describe(l.id), signatureHits: hits, confidence: "conclusive" as const } : null;
    })
    .filter(Boolean);

  if (!("fileId" in parsed.data)) {
    return NextResponse.json({ method: "signature", matches: signatureMatches }, { headers: NO_STORE });
  }

  const file = await prisma.datasetFile.findUnique({ where: { id: parsed.data.fileId }, include: { version: true } });
  if (!file || file.version.datasetId !== id) return jsonError("File not found", 404);
  const format = detectFingerprintFormat(file.path, file.mimeType);
  if (format === "binary") return NextResponse.json({ method: "signature", matches: signatureMatches }, { headers: NO_STORE });

  let original: string;
  try {
    original = await readOriginalText(file);
  } catch {
    return jsonError("Could not read the original file from storage", 502);
  }

  const candidates = [];
  for (const l of licenses) {
    if (!licenseCoversVersion({ ...l, status: "ACTIVE" }, file.version)) continue;
    const { canaries } = await fingerprintContent(original, format, { seedHex: l.canarySeed, fingerprintId: l.fingerprintId, fileId: file.id });
    candidates.push({ licenseId: l.id, fingerprintId: l.fingerprintId, canaries });
  }
  const matches = traceLeak(suspect, candidates).map((m) => ({ ...describe(m.licenseId), ...m }));

  return NextResponse.json({ method: "canary", matches }, { headers: NO_STORE });
}
