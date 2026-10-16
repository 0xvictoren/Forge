/**
 * Indexes Prisma cannot express on MongoDB. Run after `prisma db push`:
 *   npx tsx scripts/ensure-indexes.ts
 *
 * Purchase.paymentIntentId must be unique when present, but legacy purchases
 * have no intent id - a plain unique index treats all those nulls as duplicates.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function dropIfExists(collection: string, name: string) {
  try {
    await prisma.$runCommandRaw({ dropIndexes: collection, index: name });
    console.log(`- dropped ${collection}.${name}`);
  } catch {
    /* not present */
  }
}

async function main() {
  // Prisma-generated unique indexes on optional fields reject a second document
  // where the field is unset - replace them with partial unique indexes.
  await dropIfExists("PaymentIntent", "PaymentIntent_txHash_key");
  await dropIfExists("DatasetLicense", "DatasetLicense_purchaseId_key");
  await prisma.$runCommandRaw({
    createIndexes: "PaymentIntent",
    indexes: [{ key: { txHash: 1 }, name: "PaymentIntent_txHash_partial_unique", unique: true, partialFilterExpression: { txHash: { $type: "string" } } }],
  });
  console.log("✓ PaymentIntent_txHash_partial_unique");
  await prisma.$runCommandRaw({
    createIndexes: "DatasetLicense",
    indexes: [{ key: { purchaseId: 1 }, name: "DatasetLicense_purchaseId_partial_unique", unique: true, partialFilterExpression: { purchaseId: { $type: "objectId" } } }],
  });
  console.log("✓ DatasetLicense_purchaseId_partial_unique");
  await prisma.$runCommandRaw({
    createIndexes: "Purchase",
    indexes: [
      {
        key: { paymentIntentId: 1 },
        name: "Purchase_paymentIntentId_partial_unique",
        unique: true,
        partialFilterExpression: { paymentIntentId: { $type: "string" } },
      },
    ],
  });
  console.log("✓ Purchase_paymentIntentId_partial_unique");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
