import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { WalletAwareLayout } from "@/components/layout/wallet-aware-layout";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return <WalletAwareLayout>{children}</WalletAwareLayout>;
}
