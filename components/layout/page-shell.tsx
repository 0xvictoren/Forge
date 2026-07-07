import { ShellLayout } from "@/components/layout/shell-layout";

export function PageShell({
  children,
  showSearch = true,
}: {
  children: React.ReactNode;
  showSearch?: boolean;
}) {
  return <ShellLayout showSearch={showSearch}>{children}</ShellLayout>;
}