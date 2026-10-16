import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/** For server pages behind a wallet session: send visitors to sign in and come back. */
export async function requirePageUser(returnTo: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/?return=${encodeURIComponent(returnTo)}`);
  return user;
}
