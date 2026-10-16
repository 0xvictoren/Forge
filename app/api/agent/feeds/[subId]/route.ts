import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isObjectId, jsonError } from "@/lib/datasets/api";
import { authenticateAgent } from "@/lib/agents/agent-auth";

/** Stop a feed subscription owned by the signing agent. */
export async function DELETE(request: Request, { params }: { params: Promise<{ subId: string }> }) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  const { subId } = await params;
  if (!isObjectId(subId)) return jsonError("Subscription not found", 404);
  const res = await prisma.feedSubscription.updateMany({ where: { id: subId, sender: auth.sender }, data: { active: false } });
  if (!res.count) return jsonError("Subscription not found", 404);
  return NextResponse.json({ ok: true });
}
