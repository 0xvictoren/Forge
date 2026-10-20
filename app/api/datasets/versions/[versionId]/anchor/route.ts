import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, requireUser } from "@/lib/datasets/api";
import { verifyAnchorTransaction } from "@/lib/datasets/provenance-server";
import { notifyFeed } from "@/lib/agents/feeds";
import { commitFingerprints } from "@/lib/datasets/originality";
import { refreshRating } from "@/lib/datasets/rating";

const schema = z.union([
  z.object({ txHash: z.string().regex(/^0x[0-9a-f]{64}$/i) }),
  z.object({ offChain: z.literal(true) }),
]);

/** Phase 2 of sealing: verify the onchain anchor and freeze the version. */
export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { versionId } = await params;
  if (!isObjectId(versionId)) return jsonError("Version not found", 404);

  const version = await prisma.datasetVersion.findUnique({ where: { id: versionId }, include: { dataset: true } });
  if (!version || version.dataset.ownerId !== auth.user.id) return jsonError("Version not found", 404);
  if (version.status === "SEALED") return jsonError("Already sealed");
  if (!version.sealHash || !version.manifestHash || !version.datasheetHash) return jsonError("Prepare the seal first");

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Provide the anchor transaction hash");

  let anchor: { anchorTxHash: string | null; anchoredAt: Date | null; anchorNetwork: string | null } = {
    anchorTxHash: null,
    anchoredAt: null,
    anchorNetwork: null,
  };

  if ("txHash" in parsed.data) {
    const owner = auth.user.walletAddress || auth.user.address;
    if (!owner) return jsonError("Connect a wallet to anchor");
    const result = await verifyAnchorTransaction(parsed.data.txHash, {
      owner,
      datasetId: version.datasetId,
      versionNumber: version.versionNumber,
      manifestHash: version.manifestHash,
      datasheetHash: version.datasheetHash,
      sealHash: version.sealHash,
    });
    if (!result.valid) return jsonError(result.error || "Anchor could not be verified");
    anchor = { anchorTxHash: parsed.data.txHash, anchoredAt: result.anchoredAt ?? new Date(), anchorNetwork: "shelbynet" };
  }

  const sealed = await prisma.datasetVersion.update({
    where: { id: version.id },
    data: { status: "SEALED", sealedAt: new Date(), ...anchor },
  });
  await prisma.dataset.update({
    where: { id: version.datasetId },
    data: { latestVersionId: sealed.id, ...(sealed.originalityScore != null ? { originalityScore: sealed.originalityScore } : {}) },
  });
  await commitFingerprints(sealed.id);
  await refreshRating(version.datasetId).catch(() => null);
  await notifyFeed(version.datasetId, new URL(request.url).origin).catch(() => 0);

  return NextResponse.json({ version: { id: sealed.id, sealHash: sealed.sealHash, anchorTxHash: sealed.anchorTxHash } });
}
