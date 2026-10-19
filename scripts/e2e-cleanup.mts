/**
 * Remove everything created by the scripts/e2e-*.mts suites.
 *   npx tsx --env-file=.env scripts/e2e-cleanup.mts
 * Only touches datasets titled "E2E kitchen hand-pose …" or "E2E sponsored …" tagged "e2e", plus the
 * licences, purchases, certificates, intents, logs and compliance projects tied to them.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const datasets = await prisma.dataset.findMany({
  where: { OR: [{ title: { startsWith: "E2E kitchen hand-pose" } }, { title: { startsWith: "E2E sponsored" } }], tags: { has: "e2e" } },
  select: { id: true, ownerId: true, versions: { select: { id: true } } },
});
const datasetIds = datasets.map((d) => d.id);
const versionIds = datasets.flatMap((d) => d.versions.map((v) => v.id));
const licenses = await prisma.datasetLicense.findMany({ where: { datasetId: { in: datasetIds } }, select: { id: true, purchaseId: true, buyerId: true } });
const purchaseIds = licenses.map((l) => l.purchaseId).filter((x): x is string => !!x);
const intentTargets = datasetIds.flatMap((id) => ["RESEARCH", "COMMERCIAL", "EXCLUSIVE"].map((t) => `${id}:${t}`));
const testUsers = [...new Set([...datasets.map((d) => d.ownerId), ...licenses.map((l) => l.buyerId)])];

const agentReads = await prisma.agentRead.findMany({ where: { datasetId: { in: datasetIds } }, select: { payoutId: true, channelId: true } });
const payoutIds = [...new Set(agentReads.map((x) => x.payoutId).filter((x): x is string => !!x))];
const r = {
  agentReads: (await prisma.agentRead.deleteMany({ where: { datasetId: { in: datasetIds } } })).count,
  payouts: (await prisma.sellerPayout.deleteMany({ where: { id: { in: payoutIds } } })).count,
  sponsoredUploads: (await prisma.sponsoredUpload.deleteMany({ where: { versionId: { in: versionIds } } })).count,
  feeds: (await prisma.feedSubscription.deleteMany({ where: { datasetId: { in: datasetIds } } })).count,
  accessLogs: (await prisma.datasetAccessLog.deleteMany({ where: { datasetId: { in: datasetIds } } })).count,
  licenses: (await prisma.datasetLicense.deleteMany({ where: { datasetId: { in: datasetIds } } })).count,
  certificates: (await prisma.certificate.deleteMany({ where: { purchaseId: { in: purchaseIds } } })).count,
  purchases: (await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } })).count,
  intents: (await prisma.paymentIntent.deleteMany({ where: { kind: "DATASET", targetId: { in: intentTargets } } })).count,
  files: (await prisma.datasetFile.deleteMany({ where: { versionId: { in: versionIds } } })).count,
  versions: (await prisma.datasetVersion.deleteMany({ where: { id: { in: versionIds } } })).count,
  datasets: (await prisma.dataset.deleteMany({ where: { id: { in: datasetIds } } })).count,
  compliance: (await prisma.complianceProject.deleteMany({ where: { name: "E2E model", ownerId: { in: testUsers } } })).count,
};
// Agent-side test data: memory vaults written by test agents ("research-notes").
const vaults = await prisma.memoryVault.findMany({ where: { name: "research-notes" }, select: { id: true } });
const memory = (await prisma.memoryCheckpoint.deleteMany({ where: { vaultId: { in: vaults.map((v) => v.id) } } })).count;
await prisma.memoryVault.deleteMany({ where: { id: { in: vaults.map((v) => v.id) } } });
console.log({ ...r, memoryCheckpoints: memory });
console.log(`test wallet users left in place: ${testUsers.length} (they own notifications/activity rows)`);
await prisma.$disconnect();
