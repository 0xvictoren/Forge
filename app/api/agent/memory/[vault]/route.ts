import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, NO_STORE } from "@/lib/datasets/api";
import { authenticateAgent } from "@/lib/agents/agent-auth";
import { appendCheckpoint } from "@/lib/agents/memory";

const nameOk = (v: string) => /^[a-zA-Z0-9._-]{1,64}$/.test(v) && v !== "verify";
const schema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  sizeBytes: z.number().int().min(0).max(1e13),
  blobRef: z.string().max(1024).optional(),
  note: z.string().max(500).optional(),
});

/** Append a memory checkpoint for the signing agent. Content stays with the agent; Forge keeps the proof. */
export async function POST(request: Request, { params }: { params: Promise<{ vault: string }> }) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  const { vault } = await params;
  const name = decodeURIComponent(vault);
  if (!nameOk(name)) return jsonError("Vault names use letters, numbers, dot, dash and underscore (max 64)");
  let payload: unknown = null;
  try {
    payload = JSON.parse(auth.body || "null");
  } catch {
    payload = null;
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "sha256 and sizeBytes are required");
  const signature = `${request.headers.get("x-forge-timestamp")}:${request.headers.get("x-forge-signature")}`;
  try {
    const cp = await appendCheckpoint({ sender: auth.sender, vault: name, ...parsed.data, agentSignature: signature });
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      { checkpoint: { sequence: cp.sequence, entryHash: cp.entryHash, prevHash: cp.prevHash, recordedAt: cp.createdAt }, verify: `${origin}/api/agent/memory/verify?entry=${cp.entryHash}` },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not append", 409);
  }
}

/** The signing agent's checkpoints in this vault, newest first. */
export async function GET(request: Request, { params }: { params: Promise<{ vault: string }> }) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  const { vault } = await params;
  const v = await prisma.memoryVault.findUnique({ where: { sender_name: { sender: auth.sender, name: decodeURIComponent(vault) } } });
  if (!v) return jsonError("Vault not found", 404);
  const checkpoints = await prisma.memoryCheckpoint.findMany({ where: { vaultId: v.id }, orderBy: { sequence: "desc" }, take: 200, include: { batch: true } });
  return NextResponse.json(
    {
      vault: { name: v.name, headSequence: v.headSequence, headHash: v.headHash },
      checkpoints: checkpoints.map((c) => ({ sequence: c.sequence, sha256: c.sha256, sizeBytes: c.sizeBytes, blobRef: c.blobRef, note: c.note, entryHash: c.entryHash, recordedAt: c.createdAt, anchorTx: c.batch?.txHash ?? null })),
    },
    { headers: NO_STORE }
  );
}
