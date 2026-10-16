"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { PHOTOS, photoCredit, photoUrl, type PhotoKey } from "@/lib/photos";
import { cn } from "@/lib/utils";

const KEYS = Object.keys(PHOTOS) as PhotoKey[];

export function CoverPicker({ value, onChange }: { value: string | null; onChange: (url: string, credit: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {KEYS.map((k) => {
        const url = photoUrl(PHOTOS[k], 1600, 80);
        const active = value === url;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(url, photoCredit(PHOTOS[k]).text)}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-2xl ring-offset-2 ring-offset-[var(--bg-elevated)] transition-all duration-300",
              active ? "ring-[3px] ring-[var(--accent)]" : "hover:opacity-90"
            )}
            aria-pressed={active}
            aria-label={PHOTOS[k].alt}
          >
            <Image src={photoUrl(PHOTOS[k], 400, 70)} alt="" fill sizes="160px" className="object-cover" />
            {active && (
              <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
