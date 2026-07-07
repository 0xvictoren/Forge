import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd",
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    const usd = data?.aptos?.usd ?? 0;
    return NextResponse.json({ usd });
  } catch {
    return NextResponse.json({ usd: 0 });
  }
}
