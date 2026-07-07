"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function ReferralTracker() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (!ref) return;
    sessionStorage.setItem("forge_ref", ref);
    fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref, eventType: "VISIT" }),
    }).catch(() => {});
  }, [ref]);

  return null;
}
