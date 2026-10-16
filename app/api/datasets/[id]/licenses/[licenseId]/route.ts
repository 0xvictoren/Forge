import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError, requireUser } from "@/lib/datasets/api";
import { createNotification } from "@/lib/notifications";

const schema = z.object({ action: z.enum(["revoke", "reinstate"]), reason: z.string().trim().max(500).optional() });

/** Seller revokes (e.g. after a traced leak) or reinstates a licence. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; licenseId: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id, licenseId } = await params;
  if (!isObjectId(id) || !isObjectId(licenseId)) return jsonError("Licence not found", 404);
  const license = await prisma.datasetLicense.findUnique({ where: { id: licenseId }, include: { dataset: true } });
  if (!license || license.datasetId !== id || license.sellerId !== auth.user.id) return jsonError("Licence not found", 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid action");
  if (parsed.data.action === "revoke" && !parsed.data.reason) return jsonError("Give a reason. The licensee will see it");

  const updated = await prisma.datasetLicense.update({
    where: { id: licenseId },
    data:
      parsed.data.action === "revoke"
        ? { status: "REVOKED", revokedReason: parsed.data.reason }
        : { status: "ACTIVE", revokedReason: null },
  });
  await createNotification({
    userId: license.buyerId,
    type: "LICENSE",
    title: parsed.data.action === "revoke" ? "Licence revoked" : "Licence reinstated",
    body: `${license.dataset.title}${parsed.data.reason ? `, ${parsed.data.reason}` : ""}`,
    href: `/license/${license.certificateSlug}`,
  }).catch(() => undefined);
  return NextResponse.json({ license: { id: updated.id, status: updated.status } });
}
