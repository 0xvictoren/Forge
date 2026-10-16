import { NextResponse } from "next/server";
import { listAgentDatasets } from "@/lib/agents/catalog";

/** Catalog of datasets open to pay-per-read, for agents to browse. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const datasets = await listAgentDatasets({ q: url.searchParams.get("q"), modality: url.searchParams.get("modality"), origin: url.origin });
  return NextResponse.json({ datasets }, { headers: { "Cache-Control": "public, max-age=60" } });
}
