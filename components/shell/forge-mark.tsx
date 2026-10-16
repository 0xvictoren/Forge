import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Forge brand mark (favicon artwork). */
export function ForgeMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/favicon.webp"
      alt=""
      width={Math.round(size * 1.75)}
      height={size}
      className={cn("object-contain", className)}
      style={{ height: size, width: "auto" }}
    />
  );
}

/**
 * The Forge wordmark. logo.webp is drawn for light backgrounds and
 * logo-light.webp for dark ones; `onDark` forces the dark-background version
 * (e.g. over the landing hero).
 */
export function ForgeWordmark({
  className,
  href = "/",
  onDark = false,
  height = 26,
}: {
  className?: string;
  href?: string;
  onDark?: boolean;
  height?: number;
}) {
  const width = Math.round(height * 3.4);
  const style = { height, width: "auto" } as const;
  return (
    <Link href={href} className={cn("flex shrink-0 items-center rounded-full", className)} aria-label="Forge home">
      {onDark ? (
        <Image src="/logo-light.webp" alt="Forge" width={width} height={height} style={style} priority />
      ) : (
        <>
          <Image src="/logo.webp" alt="Forge" width={width} height={height} style={style} className="logo-theme-light" priority />
          <Image src="/logo-light.webp" alt="Forge" width={width} height={height} style={style} className="logo-theme-dark" priority />
        </>
      )}
    </Link>
  );
}
