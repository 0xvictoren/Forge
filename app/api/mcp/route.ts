import { NextResponse } from "next/server";
import { Account, Ed25519PrivateKey, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { MCP_INSTRUCTIONS, MCP_PROTOCOL_VERSIONS, MCP_SERVER_INFO, MCP_TOOLS, bytesToMcpContent } from "@/lib/mcp/definitions";
import { citeSources, getAgentDataset, listAgentDatasets } from "@/lib/agents/catalog";
import { channelState, settlementAddress, syncChannel } from "@/lib/agents/channels";
import { AGENT_PAYMENT_ASSET, MICROPAYMENTS_MODULE, normalizeAddr } from "@/lib/agents/config";
import { aptToOctasBig, octasToAptString } from "@/lib/agents/pricing";
import { handlePaidRead, loadReadableFile, quoteFor } from "@/lib/agents/read";
import { computeProof } from "@/lib/datasets/proof";
import { isObjectId } from "@/lib/datasets/api";
import { signMicropayment, signerFromAccount } from "@/lib/agent-client";
import { appendCheckpoint, verifyCheckpoint } from "@/lib/agents/memory";
import { sha256Hex } from "@/lib/datasets/hash";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Hosted Forge MCP server (Streamable HTTP, stateless JSON responses).
 *
 * Free tools need no credentials. read_file signs micropayments on the
 * caller's behalf with X-Forge-Session-Key: that key can only pay Forge, and
 * each read is capped (X-Forge-Max-Price-Apt, default 0.01 APT). Agents that
 * would rather keep the key local run scripts/forge-mcp.mts instead.
 */

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
const DEFAULT_MAX_READ_APT = 0.01;

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id: id ?? null, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });
const toolText = (value: unknown, isError = false) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }], isError });

function agentFromHeaders(request: Request) {
  const sender = request.headers.get("x-forge-agent");
  const key = request.headers.get("x-forge-session-key");
  if (!sender) return null;
  let session: Account | null = null;
  if (key) {
    session = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(key.trim(), PrivateKeyVariants.Ed25519)) });
  }
  return { sender: normalizeAddr(sender), session };
}

async function callTool(request: Request, name: string, args: Record<string, unknown>) {
  const origin = new URL(request.url).origin;
  const agent = agentFromHeaders(request);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : undefined);
  const rangeOf = (a: Record<string, unknown>) => {
    const start = num(a.start);
    const end = num(a.end);
    return start !== undefined || end !== undefined ? `bytes=${start ?? 0}-${end ?? ""}` : null;
  };

  switch (name) {
    case "search_datasets": {
      const datasets = await listAgentDatasets({ q: (args.query as string) || null, modality: (args.modality as string) || null, origin });
      return toolText(datasets.length ? datasets : "No datasets match. Try broader keywords.");
    }
    case "get_dataset": {
      const d = await getAgentDataset(String(args.dataset || ""), origin);
      return d ? toolText(d) : toolText("Dataset not found or not available pay-per-read.", true);
    }
    case "verify_provenance": {
      const id = String(args.versionId || "");
      if (!isObjectId(id)) return toolText("versionId must be a 24-character id", true);
      const proof = await computeProof(id);
      if (!proof) return toolText("No sealed version with that id.", true);
      return toolText({ verified: proof.verified, dataset: proof.dataset.title, version: proof.version.versionNumber, sealHash: proof.sealHash, anchorTxHash: proof.anchorTxHash, checks: proof.checks, explorer: proof.anchorExplorerUrl, availability: proof.availability });
    }
    case "quote_read": {
      const fileId = String(args.fileId || "");
      const loaded = isObjectId(fileId) ? await loadReadableFile(fileId) : null;
      if (!loaded) return toolText("File not found or not available pay-per-read.", true);
      const q = quoteFor(loaded.file.sizeBytes, rangeOf(args), loaded.pricing);
      if ("error" in q) return toolText(q.error ?? "Invalid range", true);
      return toolText({ fileId, path: loaded.file.path, bytes: q.bytes, price: `${octasToAptString(q.priceOctas)} APT`, priceOctas: q.priceOctas.toString() });
    }
    case "channel_status": {
      if (!agent) return toolText("Send X-Forge-Agent with your wallet address.", true);
      const ch = await syncChannel(agent.sender).catch(() => null);
      if (!ch) return toolText(`No channel yet. Fund one at ${origin}/agents (receiver ${settlementAddress()}).`, true);
      const s = channelState(ch)!;
      return toolText({ available: `${octasToAptString(s.available)} APT`, spent: `${octasToAptString(s.acceptedAmount)} APT`, expiresAt: s.expiresAt });
    }
    case "list_versions": {
      const dataset = String(args.dataset || "");
      const since = num(args.since) ?? 0;
      const res = await fetch(`${origin}/api/agent/datasets/${encodeURIComponent(dataset)}/versions?since=${since}`);
      return toolText(await res.json(), !res.ok);
    }
    case "verify_memory": {
      const entry = String(args.entryHash || "").toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(entry)) return toolText("entryHash must be 64 hex characters", true);
      const result = await verifyCheckpoint(entry);
      return result ? toolText(result) : toolText("No checkpoint with that hash.", true);
    }
    case "remember": {
      if (!agent?.session) return toolText("remember needs X-Forge-Agent and X-Forge-Session-Key headers.", true);
      const ch = await syncChannel(agent.sender).catch(() => null);
      if (!ch) return toolText(`No channel yet. Fund one at ${origin}/agents.`, true);
      if (`0x${Buffer.from(agent.session.publicKey.toUint8Array()).toString("hex")}` !== ch.publicKey.toLowerCase()) {
        return toolText("Session key does not match your channel.", true);
      }
      const vault = String(args.vault || "");
      if (!/^[a-zA-Z0-9._-]{1,64}$/.test(vault) || vault === "verify") return toolText("Invalid vault name", true);
      const content = new TextEncoder().encode(String(args.content ?? ""));
      const cp = await appendCheckpoint({
        sender: agent.sender,
        vault,
        sha256: await sha256Hex(content),
        sizeBytes: content.byteLength,
        note: typeof args.note === "string" ? args.note.slice(0, 500) : undefined,
        agentSignature: "hosted-mcp",
      });
      return toolText({ sequence: cp.sequence, entryHash: cp.entryHash, verify: `${origin}/api/agent/memory/verify?entry=${cp.entryHash}` });
    }
    case "cite_sources": {
      if (!agent) return toolText("Send X-Forge-Agent with your wallet address.", true);
      return toolText(await citeSources(agent.sender, origin));
    }
    case "read_file": {
      if (!agent?.session) return toolText("read_file needs X-Forge-Agent and X-Forge-Session-Key headers. Fund an agent at /agents.", true);
      const fileId = String(args.fileId || "");
      const loaded = isObjectId(fileId) ? await loadReadableFile(fileId) : null;
      if (!loaded) return toolText("File not found or not available pay-per-read.", true);
      const range = rangeOf(args);
      const q = quoteFor(loaded.file.sizeBytes, range, loaded.pricing);
      if ("error" in q) return toolText(q.error ?? "Invalid range", true);
      const headerCap = Number(request.headers.get("x-forge-max-price-apt"));
      const cap = Math.min(typeof args.maxPriceApt === "number" ? args.maxPriceApt : Infinity, Number.isFinite(headerCap) && headerCap > 0 ? headerCap : DEFAULT_MAX_READ_APT);
      if (q.priceOctas > aptToOctasBig(cap)) {
        return toolText(`This read costs ${octasToAptString(q.priceOctas)} APT, above the ${cap} APT cap. Read a smaller range or raise maxPriceApt.`, true);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const ch = await syncChannel(agent.sender).catch(() => null);
        const s = channelState(ch);
        if (!ch || !s) return toolText(`No channel yet. Fund one at ${origin}/agents.`, true);
        const header = signMicropayment(
          {
            deployer: MICROPAYMENTS_MODULE,
            sender: agent.sender,
            receiver: settlementAddress(),
            asset: AGENT_PAYMENT_ASSET,
            amount: BigInt(s.acceptedAmount) + q.priceOctas,
            channelId: BigInt(s.channelId),
            sequenceNumber: BigInt(s.nextSequenceNumber),
          },
          signerFromAccount(agent.session)
        );
        const inner = new Request(`${origin}/api/agent/files/${fileId}`, { headers: { "x-forge-micropayment": header, ...(range ? { range } : {}) } });
        const res = await handlePaidRead(inner, fileId);
        if (res.status === 409) continue;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return toolText((body as { error?: string }).error || `Read failed (${res.status})`, true);
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        return {
          content: [
            { type: "text", text: `Read ${bytes.length} bytes of ${loaded.file.path} for ${octasToAptString(q.priceOctas)} APT. Licence: ${res.headers.get("x-forge-licence")}` },
            ...bytesToMcpContent(bytes, loaded.file.mimeType),
          ],
          isError: false,
        };
      }
      return toolText("Payment state kept changing; retry the read.", true);
    }
    default:
      return null;
  }
}

async function handle(request: Request, msg: RpcRequest) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg?.id, -32600, "Invalid request");
  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion || "");
      return rpcResult(msg.id, {
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions: MCP_INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name || "");
      const args = (msg.params?.arguments as Record<string, unknown>) || {};
      try {
        const result = await callTool(request, name, args);
        return result ? rpcResult(msg.id, result) : rpcError(msg.id, -32602, `Unknown tool: ${name}`);
      } catch (e) {
        return rpcResult(msg.id, toolText(e instanceof Error ? e.message : "Tool failed", true));
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`mcp:${request.headers.get("x-forge-agent") || requestIp(request)}`, { limit: 300, windowMs: 60_000 });
  if (!rate.allowed) return NextResponse.json(rpcError(null, -32000, "Rate limited"), { status: 429 });
  let body: RpcRequest | RpcRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const m of messages) {
    // Notifications (no id) get no response.
    if (m && (m.id === undefined || m.id === null) && typeof m.method === "string" && m.method.startsWith("notifications/")) continue;
    responses.push(await handle(request, m));
  }
  if (!responses.length) return new Response(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0], { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return NextResponse.json({ ...MCP_SERVER_INFO, transport: "streamable-http", note: "POST JSON-RPC 2.0 messages to this URL." }, { status: 405, headers: { Allow: "POST" } });
}
