import { NextResponse } from "next/server";
import { AGENT_PAYMENT_ASSET, AGENT_PAYMENT_SYMBOL, CHANNEL_SAFETY_MARGIN_MS, MICROPAYMENTS_MODULE } from "@/lib/agents/config";
import { settlementAddress } from "@/lib/agents/channels";

/** Discovery document for agents: where to pay and which endpoints to call. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      name: "Forge",
      description: "Licensed, provenance-sealed AI training data. Agents pay per read through a Shelby micropayment channel.",
      payment: {
        scheme: "shelby-micropayment-v1",
        network: "shelbynet",
        receiver: settlementAddress(),
        asset: AGENT_PAYMENT_ASSET,
        symbol: AGENT_PAYMENT_SYMBOL,
        decimals: 8,
        micropaymentsModule: MICROPAYMENTS_MODULE,
        header: "X-Forge-Micropayment",
        minChannelLifetimeSeconds: Math.round(CHANNEL_SAFETY_MARGIN_MS / 1000),
      },
      endpoints: {
        catalog: `${origin}/api/agent/datasets`,
        dataset: `${origin}/api/agent/datasets/{datasetId}`,
        quote: `${origin}/api/agent/files/{fileId}/quote`,
        read: `${origin}/api/agent/files/{fileId}`,
        channel: `${origin}/api/agent/channel?sender={address}`,
        proof: `${origin}/api/datasets/proof/{versionId}`,
      },
      docs: `${origin}/agents`,
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
