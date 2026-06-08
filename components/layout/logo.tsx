import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  iconClassName = "h-8 w-8",
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
        width={32}
        height={32}
        className={cn("rounded-lg object-cover", iconClassName)}
        priority
      />
    </Link>
  );
}
