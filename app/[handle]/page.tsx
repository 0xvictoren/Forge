import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { BehanceProfile } from "@/components/profile/behance-profile";

const RESERVED = new Set([
  "hire",
  "wallet",
  "home",
  "upload",
  "chat",
  "profile",
  "onboarding",
  "dashboard",
  "lobby",
  "api",
  "b",
  "view",
  "pay",
  "explore",
]);

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const cleanHandle = handle.replace(/^@/, "");

  if (RESERVED.has(cleanHandle.toLowerCase())) notFound();

  const exists =
    (await prisma.creatorProfile.findUnique({ where: { handle: cleanHandle } })) ||
    (await prisma.user.findUnique({ where: { username: cleanHandle } }));

  if (!exists) notFound();

  return (
    <PageShell showSearch={false}>
      <BehanceProfile handle={cleanHandle} />
    </PageShell>
  );
}
