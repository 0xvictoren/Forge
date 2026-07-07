import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export function generateCertificateId(): string {
  return `FG-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export function generateVerificationSlug(): string {
  return randomBytes(12).toString("hex");
}

export async function issueCertificate(input: {
  purchaseId: string;
  buyerId: string;
  sellerId: string;
  title: string;
  txHash: string;
  assetId?: string;
  productId?: string;
}) {
  const certificateId = generateCertificateId();
  const verificationSlug = generateVerificationSlug();

  return prisma.certificate.create({
    data: {
      certificateId,
      verificationSlug,
      purchaseId: input.purchaseId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      title: input.title,
      txHash: input.txHash,
      assetId: input.assetId,
      productId: input.productId,
      network: "shelbynet",
    },
  });
}
