import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "forge_session";
const PROTECTED_PREFIXES = [
  "/home",
  "/upload",
  "/chat",
  "/wallet",
  "/profile",
  "/vaults",
  "/library",
  "/workspaces",
  "/onboarding",
  "/dashboard",
  "/bundles",
  "/stream",
  "/studio",
  "/licenses",
  "/compliance",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("return", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/studio",
    "/studio/:path*",
    "/licenses",
    "/licenses/:path*",
    "/compliance",
    "/compliance/:path*",
    "/home",
    "/home/:path*",
    "/upload",
    "/upload/:path*",
    "/chat",
    "/chat/:path*",
    "/wallet",
    "/wallet/:path*",
    "/profile",
    "/profile/:path*",
    "/vaults",
    "/vaults/:path*",
    "/library",
    "/library/:path*",
    "/workspaces",
    "/workspaces/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/bundles",
    "/bundles/:path*",
    "/stream",
    "/stream/:path*",
  ],
};
