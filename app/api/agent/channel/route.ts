import { NextResponse } from "next/server";
import { jsonError } from "@/lib/datasets/api";
import { channelState, settlementAddress, syncChannel } from "@/lib/agents/channels";
import { normalizeAddr } from "@/lib/agents/config";
import { prisma } from "@/lib/db";
import { octasToAptString } from "@/lib/agents/pricing";

/** An agent's channel to Forge as Forge sees it: use this to resync after errors. */
export async function GET(request: Request) {
  const sender = new URL(request.url).searchParams.get("sender");
  if (!sender) return jsonError("sender query parameter required");
  let addr: string;
  try {
    addr = normalizeAddr(sender);
  } catch {
    return jsonError("Invalid sender address");
  }
  const channel = await syncChannel(addr).catch(() => null);
  if (!channel) {
    return NextResponse.json({ receiver: settlementAddress(), channel: null, hint: "Open a channel to the receiver with @shelby-protocol/sdk, then retry." }, { status: 404 });
  }
  const reads = await prisma.agentRead.aggregate({ where: { channelId: channel.id }, _count: true });
  return NextResponse.json(
    {
      receiver: settlementAddress(),
      channel: channelState(channel),
      spent: octasToAptString(channel.acceptedAmount),
      reads: reads._count,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
