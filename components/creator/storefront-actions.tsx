"use client";

import { useState } from "react";
import Link from "next/link";
import { SubscribeModal, type Tier } from "./subscribe-modal";
import { TipModal } from "./tip-modal";

interface Props {
  creatorHandle: string;
  creatorAddress: string;
  tiers: Tier[];
}

export function StorefrontActions({
  creatorHandle,
  creatorAddress,
  tiers,
}: Props) {
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  if (!creatorAddress) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Creator wallet not linked
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {tiers.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setSubscribeOpen(true)}
          >
            Subscribe
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={() => setTipOpen(true)}>
          Tip
        </button>
        <Link href="/chat" className="btn-ghost">
          Message
        </Link>
      </div>

      <SubscribeModal
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        creatorHandle={creatorHandle}
        creatorAddress={creatorAddress}
        tiers={tiers}
      />
      <TipModal
        open={tipOpen}
        onOpenChange={setTipOpen}
        creatorHandle={creatorHandle}
        creatorAddress={creatorAddress}
      />
    </>
  );
}
