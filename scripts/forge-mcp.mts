#!/usr/bin/env -S npx tsx
/**
 * Forge MCP server over stdio. The session key stays on this machine: paid
 * reads are signed locally; free tools are proxied to the hosted endpoint.
 *
 * Claude Desktop / Claude Code config:
 *   {
 *     "mcpServers": {
 *       "forge": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/forge/scripts/forge-mcp.mts"],
 *         "env": {
 *           "FORGE_URL": "https://your-forge-host",
 *           "FORGE_AGENT_SENDER": "0x…",
 *           "FORGE_AGENT_SESSION_KEY": "0x…",
 *           "FORGE_MAX_READ_APT": "0.01"
 *         }
 *       }
 *     }
 *   }
 */
import { createInterface } from "node:readline";
import { Account, Ed25519PrivateKey, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { ForgeAgentClient, ForgeAgentExtras, PaymentError, signerFromAccount } from "../lib/agent-client/index";
import { MCP_INSTRUCTIONS, MCP_PROTOCOL_VERSIONS, MCP_SERVER_INFO, MCP_TOOLS, bytesToMcpContent } from "../lib/mcp/definitions";

const BASE = (process.env.FORGE_URL || "http://localhost:3000").replace(/\/$/, "");
const SENDER = process.env.FORGE_AGENT_SENDER || "";
const KEY = process.env.FORGE_AGENT_SESSION_KEY || "";
const MAX_READ_APT = Number(process.env.FORGE_MAX_READ_APT || "0.01");
const log = (...a: unknown[]) => console.error("[forge-mcp]", ...a);

const client =
  SENDER && KEY
    ? new ForgeAgentClient({
        baseUrl: BASE,
        sender: SENDER,
        signer: Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(KEY, PrivateKeyVariants.Ed25519)) }),
        maxPricePerReadOctas: BigInt(Math.round(MAX_READ_APT * 1e8)),
      })
    : null;

const session = SENDER && KEY ? Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(KEY, PrivateKeyVariants.Ed25519)) }) : null;
const extras = client && session ? new ForgeAgentExtras(client, signerFromAccount(session)) : null;

const text = (value: unknown, isError = false) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }], isError });

/** Free tools run on the hosted endpoint (no key is sent). */
async function proxy(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(SENDER ? { "x-forge-agent": SENDER } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { message: string } };
  return body.result ?? text(body.error?.message || "Forge request failed", true);
}

async function readFile(args: Record<string, unknown>) {
  if (!client) return text("Set FORGE_AGENT_SENDER and FORGE_AGENT_SESSION_KEY to read files. Fund an agent at " + `${BASE}/agents`, true);
  const fileId = String(args.fileId || "");
  const start = typeof args.start === "number" ? args.start : undefined;
  const end = typeof args.end === "number" ? args.end : undefined;
  const cap = typeof args.maxPriceApt === "number" ? Math.min(args.maxPriceApt, MAX_READ_APT) : MAX_READ_APT;
  client.maxPricePerReadOctas = BigInt(Math.round(cap * 1e8));
  try {
    const manifest = await fetch(`${BASE}/api/agent/files/${fileId}/quote`).then((r) => r.json());
    const fileEnd = typeof manifest.bytes === "number" ? manifest.bytes - 1 : undefined;
    const range: [number, number] | undefined = start !== undefined || end !== undefined ? [start ?? 0, end ?? fileEnd ?? 0] : undefined;
    const r = await client.read(fileId, { range });
    return {
      content: [
        { type: "text", text: `Read ${r.bytes.length} bytes for ${Number(r.chargedOctas) / 1e8} APT. Licence: ${r.licence}` },
        ...bytesToMcpContent(r.bytes, r.contentType),
      ],
      isError: false,
    };
  } catch (e) {
    return text(e instanceof PaymentError ? `${e.message}${e.payment ? ` (price ${e.payment.priceOctas} octas)` : ""}` : String(e), true);
  }
}

async function handle(msg: { id?: number | string | null; method: string; params?: Record<string, unknown> }) {
  switch (msg.method) {
    case "initialize": {
      const v = String(msg.params?.protocolVersion || "");
      return { protocolVersion: MCP_PROTOCOL_VERSIONS.includes(v) ? v : MCP_PROTOCOL_VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: MCP_SERVER_INFO, instructions: MCP_INSTRUCTIONS };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: MCP_TOOLS };
    case "tools/call": {
      const name = String(msg.params?.name || "");
      const args = (msg.params?.arguments as Record<string, unknown>) || {};
      if (name === "read_file") return readFile(args);
      if (name === "channel_status" && client) return text(await client.channel());
      if (name === "remember") {
        if (!extras) return text("Set FORGE_AGENT_SENDER and FORGE_AGENT_SESSION_KEY to use memory.", true);
        try {
          return text(await extras.remember(String(args.vault || ""), new TextEncoder().encode(String(args.content ?? "")), { note: typeof args.note === "string" ? args.note : undefined }));
        } catch (e) {
          return text(String(e instanceof Error ? e.message : e), true);
        }
      }
      return proxy(name, args);
    }
    default:
      throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let msg: { jsonrpc: string; id?: number | string | null; method: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(line);
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
    return;
  }
  if (msg.id === undefined || msg.id === null) return; // notification
  try {
    const result = await handle(msg);
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) + "\n");
  } catch (e) {
    const err = e as { code?: number; message?: string };
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: err.code ?? -32603, message: err.message || "Internal error" } }) + "\n");
  }
});
log(`ready (${BASE}${client ? ", paid reads enabled" : ", read-only"})`);
