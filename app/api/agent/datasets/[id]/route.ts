import { NextResponse } from "next/server";
import { jsonError } from "@/lib/datasets/api";
import { getAgentDataset } from "@/lib/agents/catalog";

/** Files an agent can read from a dataset, with the price of each full read. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAgentDataset(id, new URL(request.url).origin);
  if (!result) return jsonError("Dataset is not available for pay-per-read", 404);
  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
}
