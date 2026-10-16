import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { aptToOctas, octasToApt } from "@/lib/payments";
import { normalizeWalletAddress } from "@/lib/wallet-auth";
import { PLATFORM_FEE_BPS } from "@/lib/constants";
import { calculateAtomicSettlement } from "@/lib/forge-purchase";
import { verifyForgeSettlement } from "@/lib/forge-settlement";
import { storageIsSaleable } from "@/lib/shelby-lifecycle";
import { isLicenseTemplate, licenseTextHash, parseOffers, renderLicenseText } from "@/lib/datasets/licenses";

export type PaymentIntentKind = "ASSET" | "PRODUCT" | "BURNLINK" | "DATASET";

type ResolvedTarget = {
  id: string;
  sellerId: string;
  amountApt: number;
  recipient: string;
  productIdentifier: string;
  versionIdentifier: string;
  /** Extra terms bound into the onchain terms hash (e.g. licence text hash). */
  termsExtra?: Record<string, string>;
};

/** DATASET targets are "<datasetId>:<LICENSE_TEMPLATE>". */
export function parseDatasetTarget(targetKey: string) {
  const [datasetId, template] = targetKey.split(":");
  if (!datasetId || !/^[0-9a-f]{24}$/i.test(datasetId) || !isLicenseTemplate(template)) {
    throw new Error("Invalid dataset licence target");
  }
  return { datasetId, template };
}

async function resolveDatasetTarget(targetKey: string): Promise<ResolvedTarget> {
  const { datasetId, template } = parseDatasetTarget(targetKey);
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: { owner: true },
  });
  if (!dataset || dataset.visibility !== "listed" || dataset.status !== "PUBLISHED" || !dataset.latestVersionId) {
    throw new Error("Dataset is not available for licensing");
  }
  const offer = parseOffers(dataset.offers).find((o) => o.template === template);
  if (!offer) throw new Error("This licence type is not offered for this dataset");
  const version = await prisma.datasetVersion.findUnique({ where: { id: dataset.latestVersionId } });
  if (!version || version.status !== "SEALED" || !version.sealHash) {
    throw new Error("Dataset version is not sealed");
  }
  const recipient = dataset.owner.walletAddress || dataset.owner.address;
  if (!recipient) throw new Error("Seller wallet is not configured");
  const text = renderLicenseText({
    template,
    datasetTitle: dataset.title,
    datasetId: dataset.id,
    versionNumber: version.versionNumber,
    sealHash: version.sealHash,
    sellerName: dataset.owner.displayName || dataset.owner.username || recipient,
  });
  return {
    id: `${dataset.id}:${template}`,
    sellerId: dataset.ownerId,
    amountApt: offer.priceApt,
    recipient,
    productIdentifier: dataset.id,
    versionIdentifier: version.sealHash,
    termsExtra: { licenseTemplate: template, licenseTextHash: await licenseTextHash(text) },
  };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function resolveTarget(
  kind: PaymentIntentKind,
  targetKey: string
): Promise<ResolvedTarget> {
  if (kind === "DATASET") return resolveDatasetTarget(targetKey);

  if (kind === "ASSET") {
    const asset = await prisma.asset.findUnique({
      where: { id: targetKey },
      include: { owner: true },
    });
    if (!asset || !asset.isListed || asset.status !== "published") {
      throw new Error("Asset is not available for purchase");
    }
    if (!storageIsSaleable(asset)) {
      throw new Error("Asset storage is unavailable or requires renewal");
    }
    const recipient = asset.owner.walletAddress || asset.owner.address;
    if (!recipient) throw new Error("Seller wallet is not configured");
    return {
      id: asset.id,
      sellerId: asset.userId,
      amountApt: asset.priceApt,
      recipient,
      productIdentifier: asset.datasetId || asset.id,
      versionIdentifier: asset.versionId || digest({ blobRef: asset.blobRef, fileSize: asset.fileSize, mimeType: asset.mimeType }),
    };
  }

  if (kind === "PRODUCT") {
    const product = await prisma.product.findUnique({
      where: { id: targetKey },
      include: {
        owner: true,
        items: { include: { asset: true } },
        vault: { include: { assets: { include: { asset: true } } } },
      },
    });
    if (!product || !product.isActive || !product.isListed) {
      throw new Error("Product is not available for purchase");
    }
    const productAssets = [
      ...product.items.flatMap((item) => (item.asset ? [item.asset] : [])),
      ...(product.vault?.assets.map((item) => item.asset) || []),
    ];
    if (!productAssets.length || productAssets.some((asset) => !storageIsSaleable(asset))) {
      throw new Error("A product version is unavailable or requires storage renewal");
    }
    const recipient = product.owner.walletAddress || product.owner.address;
    if (!recipient) throw new Error("Seller wallet is not configured");
    return {
      id: product.id,
      sellerId: product.userId,
      amountApt: product.priceApt,
      recipient,
      productIdentifier: product.id,
      versionIdentifier: digest({
        productId: product.id,
        items: product.items.map((item) => ({
          assetId: item.assetId,
          versionId: item.asset?.versionId,
          vaultId: item.vaultId,
          sortOrder: item.sortOrder,
        })),
        vaultVersions: product.vault?.assets.map((item) => item.asset.versionId || item.asset.id),
      }),
    };
  }

  const burnLink = await prisma.burnLink.findUnique({
    where: { slug: targetKey },
    include: { owner: true },
  });
  if (!burnLink || !burnLink.isActive) {
    throw new Error("BurnLink is not available");
  }
  if (burnLink.expiresAt && burnLink.expiresAt <= new Date()) {
    throw new Error("BurnLink has expired");
  }
  const burnLinkAsset = await prisma.asset.findFirst({ where: { burnLinkId: burnLink.id } });
  if (!burnLinkAsset || !storageIsSaleable(burnLinkAsset)) {
    throw new Error("BurnLink storage is unavailable or requires renewal");
  }
  const recipient = burnLink.owner.walletAddress || burnLink.owner.address;
  if (!recipient) throw new Error("Seller wallet is not configured");
  return {
    id: burnLink.id,
    sellerId: burnLink.userId,
    amountApt: burnLink.priceApt,
    recipient,
    productIdentifier: burnLinkAsset.datasetId || burnLink.id,
    versionIdentifier: burnLinkAsset.versionId || digest({ fileId: burnLink.fileId, storageTxHash: burnLink.storageTxHash }),
  };
}

export async function createPaymentIntent(input: {
  buyerId: string;
  kind: PaymentIntentKind;
  targetKey: string;
}) {
  const target = await resolveTarget(input.kind, input.targetKey);
  if (!Number.isFinite(target.amountApt) || target.amountApt <= 0) {
    throw new Error("This item does not require payment");
  }
  if (target.sellerId === input.buyerId) {
    throw new Error("Owners do not need to purchase their own content");
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
  const nonce = randomBytes(32).toString("hex");
  const amountAtomic = aptToOctas(target.amountApt);
  const settlement = calculateAtomicSettlement(amountAtomic, PLATFORM_FEE_BPS);
  const termsHash = digest({
    kind: input.kind,
    targetId: target.id,
    sellerId: target.sellerId,
    recipient: normalizeWalletAddress(target.recipient),
    currency: "APT_TESTNET",
    amountAtomic: amountAtomic.toString(),
    feeBps: PLATFORM_FEE_BPS,
    productIdentifier: target.productIdentifier,
    versionIdentifier: target.versionIdentifier,
    nonce,
    expiresAt: expiresAt.toISOString(),
    ...(target.termsExtra ? { extra: target.termsExtra } : {}),
  });
  const intent = await prisma.paymentIntent.create({
    data: {
      nonce,
      buyerId: input.buyerId,
      sellerId: target.sellerId,
      kind: input.kind,
      targetId: target.id,
      currency: "APT_TESTNET",
      amountAtomic: amountAtomic.toString(),
      feeAtomic: settlement.feeAtomic.toString(),
      netAtomic: settlement.netAtomic.toString(),
      feeBps: PLATFORM_FEE_BPS,
      recipient: normalizeWalletAddress(target.recipient),
      productIdentifier: target.productIdentifier,
      versionIdentifier: target.versionIdentifier,
      termsHash,
      expiresAt,
    },
  });

  return {
    id: intent.id,
    kind: intent.kind,
    targetId: intent.targetId,
    currency: intent.currency,
    amountAtomic: intent.amountAtomic,
    feeAtomic: intent.feeAtomic,
    netAtomic: intent.netAtomic,
    feeBps: intent.feeBps,
    amountApt: octasToApt(BigInt(intent.amountAtomic)),
    recipient: intent.recipient,
    productIdentifier: intent.productIdentifier,
    versionIdentifier: intent.versionIdentifier,
    nonce: intent.nonce,
    termsHash: intent.termsHash,
    expiresAt: intent.expiresAt,
  };
}

export async function consumePaymentIntent(input: {
  intentId: string;
  buyerId: string;
  walletAddress: string;
  kind: PaymentIntentKind;
  targetId: string;
  txHash: string;
}) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: input.intentId },
  });
  if (!intent) throw new Error("Payment intent not found");
  if (
    intent.buyerId !== input.buyerId ||
    intent.kind !== input.kind ||
    intent.targetId !== input.targetId
  ) {
    throw new Error("Payment intent does not match this purchase");
  }
  if (intent.expiresAt <= new Date()) throw new Error("Payment intent expired");
  if (
    (intent.status === "VERIFIED" || intent.status === "COMPLETED") &&
    intent.txHash === input.txHash
  ) return intent;
  if (intent.status !== "PENDING") throw new Error("Payment intent has already been used");

  const normalizedWallet = normalizeWalletAddress(input.walletAddress);
  const existingIntent = await prisma.paymentIntent.findFirst({
    where: { txHash: input.txHash, id: { not: intent.id } },
    select: { id: true },
  });
  if (existingIntent) throw new Error("Transaction has already been used");

  const [purchase, transaction, contentPurchase] = await Promise.all([
    prisma.purchase.findUnique({ where: { txHash: input.txHash }, select: { id: true } }),
    prisma.transaction.findUnique({ where: { txHash: input.txHash }, select: { id: true } }),
    prisma.contentPurchase.findUnique({ where: { txHash: input.txHash }, select: { id: true } }),
  ]);
  if (purchase || transaction || contentPurchase) {
    throw new Error("Transaction has already been used");
  }

  const verification = await verifyForgeSettlement(input.txHash, {
    buyer: normalizedWallet,
    seller: intent.recipient,
    amountAtomic: intent.amountAtomic,
    feeBps: intent.feeBps,
    purchaseIntentId: intent.id,
    productIdentifier: intent.productIdentifier,
    versionIdentifier: intent.versionIdentifier,
    nonce: intent.nonce,
    termsHash: intent.termsHash,
    expiresAt: intent.expiresAt,
    notBefore: intent.createdAt,
  });
  if (!verification.valid) {
    throw new Error(verification.error || "Payment verification failed");
  }

  const claimed = await prisma.paymentIntent.updateMany({
    // On MongoDB an unset field does not match `null`, so accept both.
    where: { id: intent.id, status: "PENDING", OR: [{ txHash: null }, { txHash: { isSet: false } }] },
    data: { status: "VERIFIED", txHash: input.txHash },
  });
  if (claimed.count !== 1) {
    throw new Error("Payment intent was consumed by another request");
  }

  return prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
}

export async function completePaymentIntent(intentId: string, txHash: string) {
  await prisma.paymentIntent.updateMany({
    where: { id: intentId, txHash, status: "VERIFIED" },
    data: { status: "COMPLETED" },
  });
}
