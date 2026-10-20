import "server-only";
import { prisma } from "@/lib/db";
import { combineRating } from "./rating-math";

/** Usage window behind the market part of the rating (see rating-math.ts). */
const WINDOW_DAYS = 90;

export type RatingDetail = {
  originality: number | null;
  market: number | null;
  buyerAverage: number | null;
  buyerCount: number;
  ratingCount: number;
  signals: { viewers: number; agentsLooked: number; buyers: number; repeatAgents: number; walkaways: number };
  updatedAt: string;
};

export async function refreshRating(datasetId: string) {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const dataset = await prisma.dataset.findUnique({ where: { id: datasetId }, select: { id: true, viewCount: true, originalityScore: true } });
  if (!dataset) return null;

  const [licences, reads, signals, ratings] = await Promise.all([
    prisma.datasetLicense.findMany({ where: { datasetId, template: { not: "METERED" } }, select: { buyerId: true } }),
    prisma.agentRead.findMany({ where: { datasetId, createdAt: { gte: since } }, select: { buyerId: true, createdAt: true, channel: { select: { sender: true } } } }),
    prisma.datasetSignal.findMany({ where: { datasetId, createdAt: { gte: since } }, select: { actor: true } }),
    prisma.datasetRating.findMany({ where: { datasetId }, select: { score: true } }),
  ]);

  const daysByAgent = new Map<string, Set<string>>();
  for (const r of reads) {
    const who = r.channel.sender.toLowerCase();
    if (!daysByAgent.has(who)) daysByAgent.set(who, new Set());
    daysByAgent.get(who)!.add(r.createdAt.toISOString().slice(0, 10));
  }
  const lookers = new Set(signals.map((s) => s.actor?.toLowerCase()).filter(Boolean) as string[]);
  const anonymousLooks = signals.filter((s) => !s.actor).length;
  const walkaways = [...lookers].filter((a) => !daysByAgent.has(a)).length;
  const repeatAgents = [...daysByAgent.values()].filter((d) => d.size >= 2).length;

  const result = combineRating({
    originality: dataset.originalityScore,
    viewers: dataset.viewCount,
    agentsLooked: lookers.size + Math.min(anonymousLooks, 50),
    humanBuyers: new Set(licences.map((l) => l.buyerId)).size,
    agentBuyers: daysByAgent.size,
    repeatAgents,
    walkaways,
    ratings: ratings.map((r) => r.score),
  });

  const detail: RatingDetail = {
    originality: dataset.originalityScore,
    market: result.market,
    buyerAverage: result.buyerAverage,
    buyerCount: result.buyers,
    ratingCount: ratings.length,
    signals: { viewers: dataset.viewCount, agentsLooked: lookers.size, buyers: result.buyers, repeatAgents, walkaways },
    updatedAt: new Date().toISOString(),
  };
  await prisma.dataset.update({ where: { id: datasetId }, data: { rating: result.rating, ratingDetail: detail } });
  return { rating: result.rating, detail };
}

export async function refreshAllRatings() {
  const rows = await prisma.dataset.findMany({ where: { status: { in: ["PUBLISHED", "EXCLUSIVE_SOLD"] } }, select: { id: true } });
  let updated = 0;
  for (const r of rows) if (await refreshRating(r.id).catch(() => null)) updated++;
  return { updated };
}

/** Record that an agent looked at a dataset or asked for a price. Never throws. */
export function recordSignal(datasetId: string, kind: "AGENT_VIEW" | "AGENT_QUOTE", actor?: string | null) {
  prisma.datasetSignal.create({ data: { datasetId, kind, actor: actor?.toLowerCase() || null } }).catch(() => undefined);
}
