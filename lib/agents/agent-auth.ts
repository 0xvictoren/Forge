import "server-only";
import { createHash } from "crypto";
import { Ed25519PublicKey, Ed25519Signature } from "@aptos-labs/ts-sdk";
import type { AgentChannel } from "@prisma/client";
import { agentRequestMessage } from "@/lib/agent-client";
import { normalizeAddr } from "./config";
import { syncChannel } from "./channels";

const WINDOW_MS = 5 * 60 * 1000;
const seen = new Map<string, number>();

export type AgentAuth = { ok: true; sender: string; channel: AgentChannel; body: string } | { ok: false; status: number; error: string };

/**
 * Authenticate a request signed with the agent's channel session key. The
 * channel's onchain public key is the agent's identity, so no accounts or API
 * keys exist. Signatures are single-use within a five-minute window.
 */
export async function authenticateAgent(request: Request): Promise<AgentAuth> {
  const senderRaw = request.headers.get("x-forge-agent");
  const ts = Number(request.headers.get("x-forge-timestamp"));
  const sig = request.headers.get("x-forge-signature");
  if (!senderRaw || !sig || !Number.isFinite(ts)) return { ok: false, status: 401, error: "Signed agent request required (X-Forge-Agent, X-Forge-Timestamp, X-Forge-Signature)" };
  if (Math.abs(Date.now() - ts) > WINDOW_MS) return { ok: false, status: 401, error: "Request timestamp is outside the 5 minute window" };
  if (seen.has(sig)) return { ok: false, status: 401, error: "Replayed request signature" };

  let sender: string;
  try {
    sender = normalizeAddr(senderRaw);
  } catch {
    return { ok: false, status: 400, error: "Invalid agent address" };
  }
  const channel = await syncChannel(sender).catch(() => null);
  if (!channel) return { ok: false, status: 403, error: "This agent has no payment channel to Forge" };

  const body = request.method === "GET" || request.method === "DELETE" ? "" : await request.text();
  const bodySha256 = createHash("sha256").update(body).digest("hex");
  const message = agentRequestMessage({ method: request.method, path: new URL(request.url).pathname, timestamp: ts, bodySha256 });
  let valid = false;
  try {
    valid = new Ed25519PublicKey(channel.publicKey).verifySignature({ message, signature: new Ed25519Signature(sig) });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, status: 401, error: "Invalid agent signature" };

  seen.set(sig, Date.now());
  if (seen.size > 20_000) for (const [k, t] of seen) if (Date.now() - t > WINDOW_MS) seen.delete(k);
  return { ok: true, sender, channel, body };
}
