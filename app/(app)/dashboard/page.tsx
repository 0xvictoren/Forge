import { getSessionUser } from "@/lib/auth";
import { truncateAddress } from "@/lib/utils";
import { CreatorDashboard } from "@/components/v2/creator-dashboard";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const name =
    user.displayName ||
    user.username ||
    (user.walletAddress ? truncateAddress(user.walletAddress) : "Creator");

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-0">
      <CreatorDashboard userName={name} />
    </div>
  );
}