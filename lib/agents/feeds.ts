import "server-only";
import { createHmac, randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { prisma } from "@/lib/db";

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd]/i, /^fe80/i];

/** Only public HTTPS endpoints may receive webhooks (no SSRF into private networks). */
export async function assertSafeWebhook(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Webhook must be a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("Webhook must use https");
  if (url.username || url.password) throw new Error("Webhook must not contain credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Webhook host is not public");
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("Webhook host does not resolve");
  if (addrs.some((a) => PRIVATE.some((re) => re.test(a.address)))) throw new Error("Webhook host resolves to a private address");
  return url.toString();
}

export function newWebhookSecret() {
  return randomBytes(24).toString("hex");
}

export function signWebhook(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Tell every subscriber about sealed versions they haven't seen. Safe to call
 * repeatedly: each subscription remembers the last version it was sent.
 */
export async function notifyFeed(datasetId: string, origin: string) {
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: { versions: { where: { status: "SEALED" }, orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const latest = dataset?.versions[0];
  if (!dataset || !latest || dataset.visibility !== "listed" || dataset.status !== "PUBLISHED") return 0;
  const subs = await prisma.feedSubscription.findMany({ where: { datasetId, active: true, lastNotifiedVersion: { lt: latest.versionNumber } } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      const body = JSON.stringify({
        event: "dataset.version.sealed",
        deliveredAt: new Date().toISOString(),
        dataset: { id: dataset.id, slug: dataset.slug, title: dataset.title },
        version: { id: latest.id, number: latest.versionNumber, sealHash: latest.sealHash, anchorTxHash: latest.anchorTxHash, fileCount: latest.fileCount, totalBytes: latest.totalBytes },
        previousVersion: s.lastNotifiedVersion,
        manifest: `${origin}/api/agent/datasets/${dataset.id}`,
        proof: `${origin}/api/datasets/proof/${latest.id}`,
      });
      let status = 0;
      try {
        const res = await fetch(s.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forge-event": "dataset.version.sealed", "x-forge-signature": signWebhook(s.secret, body) },
          body,
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });
        status = res.status;
      } catch {
        status = 0;
      }
      const delivered = status >= 200 && status < 300;
      await prisma.feedSubscription.update({
        where: { id: s.id },
        data: { lastDeliveryStatus: status, ...(delivered ? { lastNotifiedVersion: latest.versionNumber } : {}) },
      });
      if (delivered) sent++;
    })
  );
  return sent;
}

/** Catch-up for deliveries that failed or were cut short (run from cron). */
export async function notifyAllPending(origin: string) {
  const ids = await prisma.feedSubscription.findMany({ where: { active: true }, select: { datasetId: true }, distinct: ["datasetId"] });
  let sent = 0;
  for (const { datasetId } of ids) sent += await notifyFeed(datasetId, origin);
  return sent;
}
