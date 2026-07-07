"use client";

import { useState } from "react";
import { toast } from "sonner";

export function AssetListToggle({
  assetId,
  initialListed,
}: {
  assetId: string;
  initialListed: boolean;
}) {
  const [isListed, setIsListed] = useState(initialListed);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isListed: !isListed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setIsListed(!isListed);
      toast.success(!isListed ? "Listed on Explore" : "Removed from Explore");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="btn-accent-ghost w-full text-sm"
    >
      {loading ? "Updating…" : isListed ? "Remove from Explore" : "List on Explore"}
    </button>
  );
}