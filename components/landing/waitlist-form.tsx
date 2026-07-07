"use client";

import { useState } from "react";
import { toast } from "sonner";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join waitlist");
      setDone(true);
      toast.success("You're on the list!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p className="text-sm font-medium text-[var(--green)]">
        Thanks! We&apos;ll notify you when new features launch.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input flex-1"
        aria-label="Email address"
      />
      <button type="submit" disabled={loading} className="btn-brand shrink-0 px-6">
        {loading ? "Joining…" : "Join waitlist"}
      </button>
    </form>
  );
}