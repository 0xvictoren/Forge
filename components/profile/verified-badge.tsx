import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("inline h-4 w-4 shrink-0 text-[var(--brand)]", className)}
      aria-label="Verified"
    />
  );
}
