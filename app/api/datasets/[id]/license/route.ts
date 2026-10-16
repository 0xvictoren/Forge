import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, rateLimited, requireUser } from "@/lib/datasets/api";
import { LICENSE_TEMPLATES, licenseTextHash, parseOffers, renderLicenseText } from "@/lib/datasets/licenses";
import { newFingerprintId, newSecretHex } from "@/lib/datasets/server";
import { completePaymentIntent, consumePaymentIntent } from "@/lib/payment-intents";
import { completePurchase } from "@/lib/v2/purchase";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  template: z.enum(LICENSE_TEMPLATES),
  intentId: z.string().optional(),
  txHash: z.string().regex(/^0x[0-9a-f]{64}$/i).optional(),
  orgName: z.string().trim().max(160).optional(),
  intendedUse: z.string().trim().max(1000).optional(),
});

/**
 * Issue a licence. Paid licences require a verified onchain settlement of a
 * server-issued DATASET payment intent; zero-priced Research licences are free.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const limited = rateLimited(`dataset-license:${auth.user.id}`, 10);
  if (limited) return limited;
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Dataset not found", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid licence request");
  const { template, intentId, txHash, orgName, intendedUse } = parsed.data;

  const dataset = await prisma.dataset.findUnique({ where: { id }, include: { owner: true } });
  if (!dataset || dataset.visibility !== "listed" || dataset.status !== "PUBLISHED" || !dataset.latestVersionId) {
    return jsonError("Dataset is not available for licensing");
  }
  if (dataset.ownerId === auth.user.id) return jsonError("You own this dataset");
  const offer = parseOffers(dataset.offers).find((o) => o.template === template);
  if (!offer) return jsonError("This licence type is not offered");

  const version = await prisma.datasetVersion.findUnique({ where: { id: dataset.latestVersionId } });
  if (!version?.sealHash || version.status !== "SEALED") return jsonError("Dataset version is not sealed");

  const existing = await prisma.datasetLicense.findFirst({
    where: { buyerId: auth.user.id, datasetId: id, versionId: version.id, template, status: "ACTIVE" },
  });
  if (existing) return NextResponse.json({ license: { certificateSlug: existing.certificateSlug }, duplicate: true });

  const sellerName = dataset.owner.displayName || dataset.owner.username || dataset.owner.walletAddress || "Seller";
  const licenseText = renderLicenseText({
    template,
    datasetTitle: dataset.title,
    datasetId: dataset.id,
    versionNumber: version.versionNumber,
    sealHash: version.sealHash,
    sellerName,
  });
  const textHash = await licenseTextHash(licenseText);

  let settlement: { txHash: string; termsHash: string; amountApt: number; paymentIntentId: string | null; purchaseId: string | null };

  if (offer.priceApt > 0) {
    const wallet = auth.user.walletAddress || auth.user.address;
    if (!intentId || !txHash || !wallet) return jsonError("Payment is required for this licence");
    let intent;
    try {
      intent = await consumePaymentIntent({
        intentId,
        buyerId: auth.user.id,
        walletAddress: wallet,
        kind: "DATASET",
        targetId: `${dataset.id}:${template}`,
        txHash,
      });
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Payment verification failed");
    }
    if (intent.versionIdentifier !== version.sealHash) return jsonError("Dataset changed while you were paying. Contact support");
    const result = await completePurchase({
      buyerId: auth.user.id,
      sellerId: dataset.ownerId,
      amountApt: offer.priceApt,
      txHash,
      purchaseType: "DATASET_LICENSE",
      title: `${dataset.title}, ${template.toLowerCase()} licence`,
      settlement: {
        id: intent.id,
        currency: intent.currency,
        amountAtomic: intent.amountAtomic,
        feeAtomic: intent.feeAtomic,
        netAtomic: intent.netAtomic,
        productIdentifier: intent.productIdentifier,
        versionIdentifier: intent.versionIdentifier,
        nonce: intent.nonce,
      },
    });
    await completePaymentIntent(intent.id, txHash);
    settlement = {
      txHash,
      termsHash: intent.termsHash,
      amountApt: offer.priceApt,
      paymentIntentId: intent.id,
      purchaseId: result.purchase.id,
    };
  } else {
    if (template !== "RESEARCH") return jsonError("Only research licences can be free");
    const freeId = randomBytes(12).toString("hex");
    settlement = { txHash: `free:${freeId}`, termsHash: textHash, amountApt: 0, paymentIntentId: null, purchaseId: null };
  }

  const license = await prisma.datasetLicense.create({
    data: {
      datasetId: dataset.id,
      versionId: version.id,
      buyerId: auth.user.id,
      sellerId: dataset.ownerId,
      purchaseId: settlement.purchaseId,
      paymentIntentId: settlement.paymentIntentId,
      template,
      licenseText,
      licenseTextHash: textHash,
      termsHash: settlement.termsHash,
      txHash: settlement.txHash,
      amountApt: settlement.amountApt,
      fingerprintId: newFingerprintId(),
      canarySeed: newSecretHex(32),
      certificateSlug: randomBytes(10).toString("hex"),
      orgName,
      intendedUse,
    },
  });

  await prisma.dataset.update({
    where: { id: dataset.id },
    data: {
      licenseCount: { increment: 1 },
      ...(template === "EXCLUSIVE" ? { status: "EXCLUSIVE_SOLD", visibility: "private" } : {}),
    },
  });

  if (offer.priceApt === 0) {
    await createNotification({
      userId: dataset.ownerId,
      type: "PURCHASE",
      title: "New research licence",
      body: `${orgName || "Someone"} licensed "${dataset.title}" for research`,
      href: `/studio/${dataset.id}`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ license: { id: license.id, certificateSlug: license.certificateSlug } }, { status: 201 });
}
