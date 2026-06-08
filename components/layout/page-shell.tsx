import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export function PageShell({
  children,
  showSearch = true,
}: {
  children: React.ReactNode;
  showSearch?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader showSearch={showSearch} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
