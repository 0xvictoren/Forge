import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./db";

export const COOKIE_NAME = "forge_session";
const EXPIRY = "7d";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

function parseCookieHeader(header: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) map.set(name, decodeURIComponent(rest.join("=")));
  }
  return map;
}

export interface SessionUser {
  id: string;
  email: string | null;
  address: string | null;
  handle: string | null;
  walletAddress: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarCid: string | null;
  avatarRef: string | null;
  bannerRef: string | null;
  isCreator: boolean;
  verified: boolean;
}

export type SessionPayload = {
  userId: string;
  email?: string;
  address?: string;
};

function normalizeAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  return addr.toLowerCase();
}

/** Sync legacy wallet/username/media fields when writing new fields. */
export function mergeUserWrite(data: {
  email?: string;
  address?: string;
  handle?: string;
  avatarRef?: string;
  bannerRef?: string;
  verificationTx?: string;
}) {
  const out: Record<string, unknown> = { ...data };
  if (data.address) {
    out.walletAddress = normalizeAddress(data.address);
    out.address = normalizeAddress(data.address);
  }
  if (data.handle) {
    out.username = data.handle;
    out.handle = data.handle;
  }
  if (data.avatarRef) {
    out.avatarCid = data.avatarRef;
    out.avatarRef = data.avatarRef;
  }
  if (data.bannerRef) {
    out.bannerCid = data.bannerRef;
    out.bannerRef = data.bannerRef;
  }
  if (data.verificationTx) {
    out.verificationTxHash = data.verificationTx;
    out.verificationTx = data.verificationTx;
  }
  return out;
}

function mapDbUser(user: {
  id: string;
  email: string | null;
  address: string | null;
  handle: string | null;
  walletAddress: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarCid: string | null;
  avatarRef: string | null;
  bannerCid: string | null;
  bannerRef: string | null;
  isCreator: boolean;
  verified: boolean;
}): SessionUser {
  const addr = normalizeAddress(user.address || user.walletAddress);
  const handle = user.handle || user.username;
  const avatarRef = user.avatarRef || user.avatarCid;
  const bannerRef = user.bannerRef || user.bannerCid;
  return {
    id: user.id,
    email: user.email,
    address: addr,
    handle,
    walletAddress: addr,
    username: user.username || handle,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    avatarCid: avatarRef,
    avatarRef,
    bannerRef,
    isCreator: user.isCreator,
    verified: user.verified,
  };
}

export async function createSession(
  userId: string,
  email?: string,
  address?: string
): Promise<string> {
  const token = await new SignJWT({
    sub: userId,
    userId,
    email: email || undefined,
    address: address ? normalizeAddress(address) : undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return token;
}

export async function getServerSession(req?: NextRequest | Request): Promise<{
  user: SessionPayload;
} | null> {
  const token = req
    ? parseCookieHeader(req.headers.get("cookie")).get(COOKIE_NAME)
    : (await cookies()).get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = (payload.sub ?? payload.userId) as string;
    if (!userId) return null;
    return {
      user: {
        userId,
        email: payload.email as string | undefined,
        address: payload.address as string | undefined,
      },
    };
  } catch {
    return null;
  }
}

export async function verifySession(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = (payload.sub ?? payload.userId) as string;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      address: true,
      handle: true,
      walletAddress: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      avatarCid: true,
      avatarRef: true,
      bannerCid: true,
      bannerRef: true,
      isCreator: true,
      verified: true,
    },
  });

  if (!user) return null;
  return mapDbUser(user);
}

