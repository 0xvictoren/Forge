import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/datasets/api";
import { contentDisposition, deliverFile, logDatasetAccess } from "@/lib/datasets/server";
import { AGENT_PAYMENT_ASSET, AGENT_PAYMENT_SYMBOL, AGENT_SENDER_HEADER, MICROPAYMENT_HEADER, MICROPAYMENTS_MODULE, normalizeAddr } from "./config";
import { channelState, checkMicropayment, commitMicropayment, settlementAddress, syncChannel } from "./channels";
import { ensureMeteredLicense } from "./metered";
import { octasToAptString, parseRange, parseReadPricing, quoteReadOctas } from "./pricing";

/** Buffer cap for one paid read. Larger files must be read in ranges. */
export const MAX_AGENT_READ_BYTES = 256 * 1024 * 1024;

export async function loadReadableFile(fileId: string) {
  const file = await prisma.datasetFile.findUnique({
    where: { id: fileId },
    include: { version: { include: { dataset: { include: { owner: true } } } } },
  });
  if (!file || file.isSample || file.version.status !== "SEALED") return null;
  const dataset = file.version.dataset;
  const pricing = parseReadPricing(dataset.readPricing);
  if (!pricing.enabled || dataset.visibility !== "listed" || dataset.status !== "PUBLISHED") return null;
  return { file, dataset, pricing };
}

export function quoteFor(sizeBytes: number, rangeHeader: string | null, pricing: ReturnType<typeof parseReadPricing>) {
  const range = parseRange(rangeHeader, sizeBytes);
  if (range === "invalid") return { error: "Invalid Range header" as const };
  const bytes = range ? range.end - range.start + 1 : sizeBytes;
  return { range, bytes, priceOctas: quoteReadOctas(bytes, pricing) };
}

/**
 * The 402 body. Shaped so any client can pay without reading docs: who to
 * pay, in what asset, how much more to sign for, and the next sequence number.
 */
export function paymentRequired(input: {
  status?: 402 | 409;
  error: string;
  priceOctas: bigint;
  bytes: number;
  channel: Awaited<ReturnType<typeof syncChannel>> | null;
  origin: string;
}) {
  const state = channelState(input.channel);
  const accepted = BigInt(state?.acceptedAmount ?? "0");
  return NextResponse.json(
    {
      error: input.error,
      payment: {
        scheme: "shelby-micropayment-v1",
        header: "X-Forge-Micropayment",
        encoding: "base64(BCS SenderBuiltMicropayment from @shelby-protocol/sdk)",
        receiver: settlementAddress(),
        asset: AGENT_PAYMENT_ASSET,
        symbol: AGENT_PAYMENT_SYMBOL,
        micropaymentsModule: MICROPAYMENTS_MODULE,
        priceOctas: input.priceOctas.toString(),
        price: octasToAptString(input.priceOctas),
        bytes: input.bytes,
        signAmount: (accepted + input.priceOctas).toString(),
        signSequenceNumber: state?.nextSequenceNumber ?? null,
        channel: state,
        docs: `${input.origin}/agents`,
      },
    },
    { status: input.status ?? 402, headers: { "Cache-Control": "no-store" } }
  );
}

/** Full paid-read flow shared by the REST route and the MCP server. */
export async function handlePaidRead(request: Request, fileId: string): Promise<Response> {
  const origin = new URL(request.url).origin;
  const loaded = await loadReadableFile(fileId);
  if (!loaded) return jsonError("File not found or not available for pay-per-read", 404);
  const { file, dataset, pricing } = loaded;

  const quote = quoteFor(file.sizeBytes, request.headers.get("range"), pricing);
  if ("error" in quote) return jsonError(quote.error ?? "Invalid Range header", 416);
  if (quote.bytes > MAX_AGENT_READ_BYTES) {
    return jsonError(`Reads are capped at ${MAX_AGENT_READ_BYTES} bytes. Use a Range header.`, 413);
  }

  const header = request.headers.get(MICROPAYMENT_HEADER);
  if (!header) {
    const sender = request.headers.get(AGENT_SENDER_HEADER);
    const channel = sender ? await syncChannel(normalizeAddr(sender)).catch(() => null) : null;
    return paymentRequired({ error: "Payment required", priceOctas: quote.priceOctas, bytes: quote.bytes, channel, origin });
  }

  const check = await checkMicropayment(header, quote.priceOctas);
  if (!check.ok) {
    if (check.status === 400) return jsonError(check.error, 400);
    return paymentRequired({ status: check.status, error: check.error, priceOctas: quote.priceOctas, bytes: quote.bytes, channel: check.channel ?? null, origin });
  }

  // Licence first (cheap, idempotent), then deliver, then commit the payment:
  // an agent is never charged for a read that fails.
  const license = await ensureMeteredLicense({
    buyerId: check.channel.userId,
    channelDbId: check.channel.id,
    dataset,
    version: file.version,
  });
  if (license.status !== "ACTIVE") return jsonError("This agent's licence has been revoked by the seller", 403);

  let body: Uint8Array;
  let sha: string | null = null;
  let fingerprinted = false;
  try {
    const delivery = await deliverFile(file, license);
    if (delivery.kind === "buffer") {
      body = delivery.body;
      sha = delivery.sha256;
      fingerprinted = delivery.fingerprinted;
    } else {
      body = new Uint8Array(await new Response(delivery.body).arrayBuffer());
    }
  } catch (e) {
    console.error("[agents] delivery failed", e);
    return jsonError("Storage is unreachable right now. You were not charged.", 502);
  }
  const slice = quote.range ? body.subarray(quote.range.start, Math.min(quote.range.end + 1, body.length)) : body;

  if (!(await commitMicropayment(check))) {
    const fresh = await prisma.agentChannel.findUnique({ where: { id: check.channel.id } });
    return paymentRequired({ status: 409, error: "Another read used this payment state. Re-sign and retry.", priceOctas: quote.priceOctas, bytes: quote.bytes, channel: fresh, origin });
  }

  await prisma.agentRead.create({
    data: {
      channelId: check.channel.id,
      datasetId: dataset.id,
      fileId: file.id,
      licenseId: license.id,
      buyerId: check.channel.userId,
      sellerId: dataset.ownerId,
      bytes: slice.byteLength,
      rangeStart: quote.range?.start,
      rangeEnd: quote.range?.end,
      priceOctas: quote.priceOctas.toString(),
      sequence: check.sequence.toString(),
      cumulative: check.amount.toString(),
      deliveredSha256: sha,
    },
  });
  await logDatasetAccess({ request, datasetId: dataset.id, licenseId: license.id, userId: check.channel.userId, fileId: file.id, action: "PIPELINE", deliveredSha256: sha });

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": contentDisposition(file.path),
    "Content-Length": String(slice.byteLength),
    "Cache-Control": "private, no-store",
    "X-Forge-Charged-Octas": quote.priceOctas.toString(),
    "X-Forge-Accepted-Amount": check.amount.toString(),
    "X-Forge-Next-Sequence": (check.sequence + BigInt(1)).toString(),
    "X-Forge-Licence": `${origin}/license/${license.certificateSlug}`,
    "X-Forge-Fingerprinted": fingerprinted ? "1" : "0",
  };
  if (quote.range) headers["Content-Range"] = `bytes ${quote.range.start}-${quote.range.end}/${body.length}`;
  return new Response(slice as BodyInit, { status: quote.range ? 206 : 200, headers });
}
