"use client";

import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export function UploadIconButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/upload")}
      className="rounded-full p-2 hover:bg-[var(--bg-hover)]"
      aria-label="Upload"
    >
      <Upload className="h-5 w-5" />
    </button>
  );
}
