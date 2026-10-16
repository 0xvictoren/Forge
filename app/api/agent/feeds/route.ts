import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, NO_STORE } from "@/lib/datasets/api";
import { authenticateAgent } from "@/lib/agents/agent-auth";
import { assertSafeWebhook, newWebhookSecret } from "@/lib/agents/feeds";
import { parseReadPricing } from "@/lib/agents/pricing";

const schema = z.object({ datasetId: z.string().regex(/^[0-9a-f]{24}$/i), webhookUrl: z.string().url().max(500) });

/** Subscribe the signing agent to a dataset's new versions. */
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  let payload: unknown = null;
  try {
    payload = JSON.parse(auth.body || "null");
  } catch {
    payload = null;
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return jsonError("datasetId and an https webhookUrl are required");
  const dataset = await prisma.dataset.findUnique({ where: { id: parsed.data.datasetId } });
  if (!dataset || dataset.visibility !== "listed" || !parseReadPricing(dataset.readPricing).enabled) return jsonError("Dataset is not available to agents", 404);
  let webhookUrl: string;
  try {
    webhookUrl = await assertSafeWebhook(parsed.data.webhookUrl);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Invalid webhook");
  }
  const count = await prisma.feedSubscription.count({ where: { sender: auth.sender, active: true } });
  if (count >= 50) return jsonError("Subscription limit reached (50)");
  const latest = await prisma.datasetVersion.findFirst({ where: { datasetId: dataset.id, status: "SEALED" }, orderBy: { versionNumber: "desc" } });
  const existing = await prisma.feedSubscription.findUnique({
    where: { datasetId_sender_webhookUrl: { datasetId: dataset.id, sender: auth.sender, webhookUrl } },
  });
  const sub = existing
    ? await prisma.feedSubscription.update({ where: { id: existing.id }, data: { active: true } })
    : await prisma.feedSubscription.create({
        data: { datasetId: dataset.id, sender: auth.sender, webhookUrl, secret: newWebhookSecret(), lastNotifiedVersion: latest?.versionNumber ?? 0 },
      });
  return NextResponse.json(
    {
      subscription: { id: sub.id, datasetId: sub.datasetId, webhookUrl: sub.webhookUrl, fromVersion: sub.lastNotifiedVersion },
      secret: sub.secret,
      verify: "Each delivery carries X-Forge-Signature: sha256=HMAC_SHA256(secret, rawBody).",
    },
    { status: existing ? 200 : 201, headers: NO_STORE }
  );
}

/** The signing agent's active subscriptions. */
export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  const subs = await prisma.feedSubscription.findMany({ where: { sender: auth.sender, active: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    {
      subscriptions: subs.map((s) => ({
        id: s.id,
        datasetId: s.datasetId,
        webhookUrl: s.webhookUrl,
        lastNotifiedVersion: s.lastNotifiedVersion,
        lastDeliveryStatus: s.lastDeliveryStatus,
      })),
    },
    { headers: NO_STORE }
  );
}
