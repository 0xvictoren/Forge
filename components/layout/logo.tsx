"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  iconClassName = "h-8 w-auto max-w-[140px]",
  href = "/",
}: {
  className?: string;
  iconClassName?: string;
  href?: string;
}) {
  return (
    <Link href={href} className={cn("flex shrink-0 items-center", className)}>
      <Image
        src="/logo.webp"
        alt="Forge"
        width={140}
        height={40}
        className={cn("logo-theme-light object-contain", iconClassName)}
        priority
      />
      <Image
        src="/logo-light.webp"
        alt="Forge"
        width={140}
        height={40}
        className={cn("logo-theme-dark object-contain", iconClassName)}
        priority
      />
    </Link>
  );
}