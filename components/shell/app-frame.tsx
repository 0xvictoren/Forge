import { cn } from "@/lib/utils";
import { NavSpacer, SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";

/** Page chrome for every marketplace screen: floating glass nav, content, footer. */
export function AppFrame({
  children,
  overHero = false,
  wide = false,
  bare = false,
  className,
}: {
  children: React.ReactNode;
  overHero?: boolean;
  wide?: boolean;
  /** No max-width container (landing, full-bleed pages). */
  bare?: boolean;
  className?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-base)]">
      <SiteNav overHero={overHero} />
      <main className={cn("flex-1", className)}>
        {bare ? (
          children
        ) : (
          <>
            <NavSpacer />
            <div className={cn("mx-auto w-full px-5 pb-20 pt-4", wide ? "max-w-[1280px]" : "max-w-[1080px]")}>{children}</div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display-lg">{title}</h1>
        {description && <p className="lede mt-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-muted flex flex-col items-center px-6 py-16 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--accent-ink)] shadow-[var(--shadow-sm)]">{icon}</div>}
      <h2 className="title">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-[15px] text-[var(--text-secondary)]">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
