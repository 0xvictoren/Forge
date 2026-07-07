"use client";

import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#dc5429]">
        <span className="mt-0.5 text-xl font-bold leading-none text-white">F</span>
      </div>
      {/* <span className="text-xl font-semibold tracking-tight">Forge</span> */}
    </Link>
  );
}
