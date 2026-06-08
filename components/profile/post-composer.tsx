"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  onPosted?: () => void;
}

export function PostComposer({ onPosted }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [category, setCategory] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onMedia = (f: File) => {
    setFile(f);
    if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview("");
    }
  };

  const submit = async () => {
    if (!text.trim() && !file) return;
    setLoading(true);
    setError("");
    setProgress(10);
    const form = new FormData();
    if (text) form.append("text", text);
    if (category) form.append("category", category);
    if (file) form.append("media", file);
    setProgress(40);
    const res = await fetch("/api/posts", { method: "POST", body: form });
    setProgress(100);
    if (!res.ok) {
      setError((await res.json()).error || "Failed to post");
      setLoading(false);
      return;
    }
    setText("");
    setFile(null);
    setPreview("");
    setCategory("");
    setProgress(0);
    setLoading(false);
    onPosted?.();
  };

  return (
    <div className="card space-y-4 p-4">
      <textarea
        className="input min-h-[80px] !rounded-lg"
        placeholder="Share an update…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {preview && (
        <div className="relative aspect-video max-h-48 overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
          {file?.type.startsWith("video/") ? (
            <video src={preview} controls className="h-full w-full object-cover" />
          ) : (
            <Image src={preview} alt="" fill className="object-cover" />
          )}
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <div className="h-1 overflow-hidden rounded bg-[var(--bg-subtle)]">
          <div className="h-full bg-[var(--brand)] transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-ghost cursor-pointer text-sm">
          Media
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onMedia(e.target.files[0])}
          />
        </label>
        <select
          className="input w-auto py-1.5 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Category</option>
          {["Graphic Design", "3D Art", "UI/UX", "Photography", "Motion Design", "Illustration", "Audio"].map(
            (c) => (
              <option key={c} value={c}>
                {c}
              </option>
            )
          )}
        </select>
        <button
          type="button"
          className="btn-primary ml-auto text-sm"
          disabled={loading || (!text.trim() && !file)}
          onClick={submit}
        >
          {loading ? "Posting…" : "Post"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
