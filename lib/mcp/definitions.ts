/**
 * Forge MCP tools, shared by the hosted endpoint (/api/mcp) and the local
 * stdio server (scripts/forge-mcp.mts). Descriptions are written for the model:
 * they say when to use each tool and what it costs.
 */

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const MCP_SERVER_INFO = { name: "forge", title: "Forge data marketplace", version: "1.0.0" };

export const MCP_INSTRUCTIONS =
  "Forge sells licensed, provenance-sealed AI training data. Use search_datasets to find data, get_dataset for files and prices, " +
  "verify_provenance to check a seal onchain before relying on data, quote_read to price a read, then read_file to pay per byte and " +
  "receive it. Prefer byte ranges for large files. Every paid read is licensed to you (Metered) and fingerprinted. Use cite_sources " +
  "to get licence certificates and seals for what you used. Use remember to keep a provable memory log.";

type JsonSchema = Record<string, unknown>;
export type McpTool = { name: string; title: string; description: string; inputSchema: JsonSchema; annotations?: Record<string, boolean> };

export const MCP_TOOLS: McpTool[] = [
  {
    name: "search_datasets",
    title: "Search datasets",
    description: "Search Forge for datasets agents can read pay-per-read. Free. Returns ids, prices per GB and seal status.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, e.g. 'robot grasping' or 'kitchen video'" },
        modality: { type: "string", enum: ["VIDEO", "ROBOTICS", "IMAGE", "AUDIO", "TEXT", "TABULAR", "SENSOR", "GEOSPATIAL", "MULTIMODAL"] },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "get_dataset",
    title: "Get dataset",
    description: "Files, sizes, SHA-256 hashes, full-read prices and provenance for one dataset. Free.",
    inputSchema: { type: "object", properties: { dataset: { type: "string", description: "Dataset id or slug" } }, required: ["dataset"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "verify_provenance",
    title: "Verify provenance",
    description: "Recompute a dataset version's seal and check its anchor transaction onchain. Free. Use before trusting data.",
    inputSchema: { type: "object", properties: { versionId: { type: "string" } }, required: ["versionId"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "quote_read",
    title: "Quote a read",
    description: "Exact price in APT for reading a file or byte range. Free. Call before read_file for large reads.",
    inputSchema: {
      type: "object",
      properties: { fileId: { type: "string" }, start: { type: "integer", minimum: 0 }, end: { type: "integer", minimum: 0, description: "Inclusive" } },
      required: ["fileId"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_file",
    title: "Read a file (paid)",
    description:
      "Pay per byte and receive a file or byte range. COSTS MONEY from your agent channel. Text files come back as text (truncated for very large reads), binary as base64. Use start/end for large files.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string" },
        start: { type: "integer", minimum: 0 },
        end: { type: "integer", minimum: 0, description: "Inclusive" },
        maxPriceApt: { type: "number", description: "Refuse if the read costs more than this" },
      },
      required: ["fileId"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "channel_status",
    title: "Channel status",
    description: "Your agent channel's balance, spend and expiry. Free.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_versions",
    title: "List versions",
    description: "Sealed versions of a dataset newer than a version number. Free. Use to keep up with live datasets.",
    inputSchema: { type: "object", properties: { dataset: { type: "string" }, since: { type: "integer", minimum: 0 } }, required: ["dataset"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "remember",
    title: "Remember",
    description:
      "Record a memory checkpoint: Forge hashes the content, chains it to your previous checkpoints and anchors it onchain hourly. Content itself is not stored. Free. Use to make what you knew provable later.",
    inputSchema: {
      type: "object",
      properties: { vault: { type: "string", description: "Vault name, e.g. 'research-notes'" }, content: { type: "string" }, note: { type: "string" } },
      required: ["vault", "content"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "verify_memory",
    title: "Verify memory",
    description: "Check a memory checkpoint by its entry hash: content hash, chain link and onchain anchor. Free.",
    inputSchema: { type: "object", properties: { entryHash: { type: "string" } }, required: ["entryHash"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "cite_sources",
    title: "Cite sources",
    description: "Licence certificates, seals and anchor transactions for every dataset you have read. Free. Use for attribution and compliance.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];

/** Bytes → MCP content: text when it decodes cleanly, otherwise a base64 blob. */
export function bytesToMcpContent(bytes: Uint8Array, mimeType: string, maxTextChars = 200_000) {
  const textual = /^(text\/|application\/(json|x-ndjson|jsonl|csv|xml))/.test(mimeType) || mimeType === "text/csv";
  if (textual) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const truncated = text.length > maxTextChars;
    return [{ type: "text", text: truncated ? `${text.slice(0, maxTextChars)}\n\n[truncated: ${text.length - maxTextChars} more characters; read a smaller range]` : text }];
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return [{ type: "resource", resource: { uri: "forge://read", mimeType, blob: btoa(bin) } }];
}
