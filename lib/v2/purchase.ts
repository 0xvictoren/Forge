import { prisma } from "@/lib/db";
import { PLATFORM_FEE_BPS } from "@/lib/constants";
import { calcFee, octasToApt } from "@/lib/payments";
import { issueCertificate } from "./certificate";
import { updateCreatorReputation } from "./reputation";
import { createNotification } from "@/lib/notifications";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { recordLibraryActivity } from "@/lib/library-activity";
import { revalidatePath } from "next/cache";
import { completePaymentIntent, consumePaymentIntent } from "@/lib/payment-intents";

export async function completePurchase(input: {
  buyerId: string;
  sellerId: string;
  amountApt: number;
  txHash: string;
  purchaseType: string;
  assetId?: string;
  productId?: string;
  vaultId?: string;
  burnLinkId?: string;
  title: string;
  settlement?: {
    id: string;
    currency: string;
    amountAtomic: string;
    feeAtomic: string;
    netAtomic: string;
    productIdentifier: string;
    versionIdentifier: string;
    nonce: string;
  };
}) {
  const existing = await prisma.purchase.findUnique({ where: { txHash: input.txHash } });
  if (existing) return { purchase: existing, certificate: null, duplicate: true };

  const amountApt = input.settlement
    ? octasToApt(BigInt(input.settlement.amountAtomic))
    : input.amountApt;
  const legacyAmounts = calcFee(amountApt, PLATFORM_FEE_BPS);
  const feeApt = input.settlement
    ? octasToApt(BigInt(input.settlement.feeAtomic))
    : legacyAmounts.feeApt;
  const netApt = input.settlement
    ? octasToApt(BigInt(input.settlement.netAtomic))
    : legacyAmounts.netApt;

  const purchase = await prisma.purchase.create({
    data: {
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      amountApt,
      feeApt,
      netApt,
      currency: input.settlement?.currency || "APT_TESTNET",
      amountAtomic: input.settlement?.amountAtomic,
      feeAtomic: input.settlement?.feeAtomic,
      netAtomic: input.settlement?.netAtomic,
      paymentIntentId: input.settlement?.id,
      productIdentifier: input.settlement?.productIdentifier,
      versionIdentifier: input.settlement?.versionIdentifier,
      paymentNonce: input.settlement?.nonce,
      txHash: input.txHash,
      purchaseType: input.purchaseType,
      assetId: input.assetId,
      productId: input.productId,
      vaultId: input.vaultId,
      burnLinkId: input.burnLinkId,
    },
  });

  if (input.assetId) {
    await prisma.asset.update({
      where: { id: input.assetId },
      data: { purchaseCount: { increment: 1 } },
    });
  }
  if (input.productId) {
    await prisma.product.update({
      where: { id: input.productId },
      data: { purchaseCount: { increment: 1 } },
    });
  }

  const certificate = await issueCertificate({
    purchaseId: purchase.id,
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    title: input.title,
    txHash: input.txHash,
    assetId: input.assetId,
    productId: input.productId,
  });

  await createNotification({
    userId: input.sellerId,
    type: "PURCHASE",
    title: "New purchase",
    body: `Someone bought "${input.title}" for ${amountApt} APT`,
    href: "/library",
  });

  await createNotification({
    userId: input.buyerId,
    type: "CERTIFICATE",
    title: "Certificate issued",
    body: `Ownership certificate for "${input.title}"`,
    href: `/cert/${certificate.verificationSlug}`,
  });

  try {
    await recordAnalyticsEvent({
      creatorId: input.sellerId,
      eventType: "PURCHASE",
      assetId: input.assetId,
      productId: input.productId,
      vaultId: input.vaultId,
      amountApt,
    });
  } catch {
    /* non-fatal */
  }

  await updateCreatorReputation(input.sellerId);

  await recordLibraryActivity({
    userId: input.buyerId,
    type: "PURCHASE",
    title: input.title,
    assetId: input.assetId,
    productId: input.productId,
    amountApt,
  });
  revalidatePath("/library");

  return { purchase, certificate, duplicate: false };
}

export async function verifyAndPurchaseAsset(opts: {
  buyerId: string;
  assetId: string;
  txHash: string;
  intentId: string;
  walletAddress: string;
}) {
  const asset = await prisma.asset.findUnique({
    where: { id: opts.assetId },
    include: { owner: true },
  });
  if (!asset) throw new Error("Asset not found");
  if (asset.priceApt <= 0) throw new Error("Asset is free");

  const creatorWallet = asset.owner.walletAddress || asset.owner.address;
  if (!creatorWallet) throw new Error("Creator wallet missing");

  const intent = await consumePaymentIntent({
    intentId: opts.intentId,
    buyerId: opts.buyerId,
    walletAddress: opts.walletAddress,
    kind: "ASSET",
    targetId: asset.id,
    txHash: opts.txHash,
  });

  const result = await completePurchase({
    buyerId: opts.buyerId,
    sellerId: asset.userId,
    amountApt: asset.priceApt,
    txHash: opts.txHash,
    purchaseType: "ASSET",
    assetId: asset.id,
    title: asset.title,
    settlement: intent,
  });
  await completePaymentIntent(opts.intentId, opts.txHash);
  return result;
}

export async function verifyAndPurchaseProduct(opts: {
  buyerId: string;
  productId: string;
  txHash: string;
  intentId: string;
  walletAddress: string;
}) {
  const product = await prisma.product.findUnique({
    where: { id: opts.productId },
    include: { owner: true, items: { include: { asset: true } } },
  });
  if (!product) throw new Error("Product not found");
  if (product.priceApt <= 0) throw new Error("Product is free");

  const creatorWallet = product.owner.walletAddress || product.owner.address;
  if (!creatorWallet) throw new Error("Creator wallet missing");

  const intent = await consumePaymentIntent({
    intentId: opts.intentId,
    buyerId: opts.buyerId,
    walletAddress: opts.walletAddress,
    kind: "PRODUCT",
    targetId: product.id,
    txHash: opts.txHash,
  });

  const result = await completePurchase({
    buyerId: opts.buyerId,
    sellerId: product.userId,
    amountApt: product.priceApt,
    txHash: opts.txHash,
    purchaseType: "BUNDLE",
    productId: product.id,
    title: product.title,
    settlement: intent,
  });
  await completePaymentIntent(opts.intentId, opts.txHash);
  return result;
}
