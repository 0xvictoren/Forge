import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NO_STORE, requireUser } from "@/lib/datasets/api";
import { normalizeAddr } from "@/lib/agents/config";
import { octasToAptString } from "@/lib/agents/pricing";

/** What the signed-in wallet's agent has been doing: reads, licences, memory, feeds. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const wallet = auth.user.walletAddress || auth.user.address;
  if (!wallet) return NextResponse.json({ wallet: null }, { headers: NO_STORE });
  const sender = normalizeAddr(wallet);

  const [reads, licenses, vaults, feeds] = await Promise.all([
    prisma.agentRead.findMany({ where: { buyerId: auth.user.id }, select: { priceOctas: true, bytes: true } }),
    prisma.datasetLicense.findMany({ where: { buyerId: auth.user.id, template: "METERED" }, include: { dataset: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.memoryVault.findMany({
      where: { sender },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { checkpoints: { orderBy: { sequence: "desc" }, take: 1, include: { batch: true } } },
    }),
    prisma.feedSubscription.findMany({ where: { sender, active: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const datasetIds = [...new Set(feeds.map((f) => f.datasetId))];
  const feedDatasets = await prisma.dataset.findMany({ where: { id: { in: datasetIds } }, select: { id: true, title: true, slug: true } });

  return NextResponse.json(
    {
      wallet: sender,
      spend: { reads: reads.length, bytes: reads.reduce((s, r) => s + r.bytes, 0), total: octasToAptString(reads.reduce((s, r) => s + BigInt(r.priceOctas), BigInt(0))) },
      licenses: licenses.map((l) => ({ dataset: l.dataset.title, slug: l.dataset.slug, certificate: `/license/${l.certificateSlug}`, status: l.status })),
      vaults: vaults.map((v) => {
        const last = v.checkpoints[0];
        return {
          name: v.name,
          checkpoints: v.headSequence,
          headHash: v.headHash,
          lastAt: last?.createdAt ?? null,
          lastAnchored: !!last?.batch?.txHash,
        };
      }),
      feeds: feeds.map((f) => ({
        id: f.id,
        dataset: feedDatasets.find((d) => d.id === f.datasetId)?.title ?? f.datasetId,
        slug: feedDatasets.find((d) => d.id === f.datasetId)?.slug ?? null,
        webhook: f.webhookUrl,
        lastNotifiedVersion: f.lastNotifiedVersion,
        lastDeliveryStatus: f.lastDeliveryStatus,
      })),
    },
    { headers: NO_STORE }
  );
}
