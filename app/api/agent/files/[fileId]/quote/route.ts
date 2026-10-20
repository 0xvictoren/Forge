import { NextResponse } from "next/server";
import { isObjectId, jsonError } from "@/lib/datasets/api";
import { loadReadableFile, quoteFor } from "@/lib/agents/read";
import { channelState, settlementAddress, syncChannel } from "@/lib/agents/channels";
import { AGENT_PAYMENT_ASSET, MICROPAYMENTS_MODULE, normalizeAddr } from "@/lib/agents/config";
import { octasToAptString } from "@/lib/agents/pricing";
import { recordSignal } from "@/lib/datasets/rating";

/** Price a read (optionally a Range) and, given ?sender=, the exact values to sign. */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!isObjectId(fileId)) return jsonError("File not found", 404);
  const loaded = await loadReadableFile(fileId);
  if (!loaded) return jsonError("File not found or not available for pay-per-read", 404);
  const url = new URL(request.url);
  const rangeHeader = request.headers.get("range") || (url.searchParams.get("range") ? `bytes=${url.searchParams.get("range")}` : null);
  const quote = quoteFor(loaded.file.sizeBytes, rangeHeader, loaded.pricing);
  if ("error" in quote) return jsonError(quote.error ?? "Invalid range", 416);
  const sender = url.searchParams.get("sender");
  recordSignal(loaded.dataset.id, "AGENT_QUOTE", sender || request.headers.get("x-forge-agent"));
  const channel = sender ? await syncChannel(normalizeAddr(sender)).catch(() => null) : null;
  const state = channelState(channel);
  return NextResponse.json(
    {
      fileId,
      bytes: quote.bytes,
      range: quote.range,
      priceOctas: quote.priceOctas.toString(),
      price: octasToAptString(quote.priceOctas),
      receiver: settlementAddress(),
      asset: AGENT_PAYMENT_ASSET,
      micropaymentsModule: MICROPAYMENTS_MODULE,
      channel: state,
      signAmount: state ? (BigInt(state.acceptedAmount) + quote.priceOctas).toString() : null,
      signSequenceNumber: state?.nextSequenceNumber ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
