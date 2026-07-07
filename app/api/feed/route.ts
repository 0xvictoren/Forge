import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getFeedPosts } from "@/lib/feed";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") || "recommended") as "recommended" | "following";
  const category = searchParams.get("category") || undefined;
  const page = Number(searchParams.get("page") || 1);
  const user = await getSessionUser();

  const result = await getFeedPosts({
    tab,
    category,
    userId: user?.id,
    page,
  });

  return NextResponse.json(result);
}
