"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { VerifiedBadge } from "@/components/profile/verified-badge";
import { useAptTransfer } from "@/lib/use-apt-transfer";
import { getPusherClient, userChannel } from "@/lib/pusher";
import { useAppStore } from "@/lib/store";
import { Check, Loader2 } from "lucide-react";

interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  description: string;
  amountApt: number;
  currency: string;
  status: string;
  notes: string | null;
  issuer: { displayName: string | null; username: string | null; verified: boolean };
}

export default function InvoicePayPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAppStore();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "paid" | "error">("idle");
  const [error, setError] = useState("");
  const { transfer, connected } = useAptTransfer();

  const load = () =>
    fetch(`/api/invoices/pay/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.invoice) {
          setInvoice(d.invoice);
          if (d.invoice.status === "paid") setStatus("paid");
        }
      });

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!user?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(userChannel(user.id));
    channel.bind("invoice-paid", () => {
      setStatus("paid");
      load();
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(userChannel(user.id));
    };
  }, [user?.id, token]);

  const pay = async () => {
    if (!invoice) return;
    setStatus("loading");
    setError("");
    try {
      const detail = await fetch(`/api/invoices/pay/${token}`).then((r) => r.json());
      const issuerWallet = detail.invoice?.issuer?.walletAddress;
      if (!issuerWallet) throw new Error("Issuer wallet not found");
      const txHash = await transfer(issuerWallet, invoice.amountApt);
      const res = await fetch(`/api/invoices/pay/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setStatus("paid");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <SiteHeader showSearch={false} />
      <div className="mx-auto max-w-md px-4 py-12">
        {!invoice ? (
          <p className="text-center text-[var(--text-muted)]">Loading invoice…</p>
        ) : (
          <div className="card p-6">
            <h1 className="text-xl font-bold text-[var(--brand)]">Forge Invoice</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{invoice.invoiceNumber}</p>

            <div className="mt-6 space-y-3 text-sm">
              <p>
                <span className="text-[var(--text-muted)]">From: </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {invoice.issuer.displayName || invoice.issuer.username}
                  {invoice.issuer.verified && <VerifiedBadge />}
                </span>
              </p>
              <p>
                <span className="text-[var(--text-muted)]">To: </span>
                {invoice.clientName}
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Work: </span>
                {invoice.description}
              </p>
              <p className="text-2xl font-bold">
                {invoice.amountApt} {invoice.currency}
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Status: </span>
                <span className={status === "paid" || invoice.status === "paid" ? "text-[var(--green)]" : ""}>
                  {status === "paid" || invoice.status === "paid" ? "Paid" : "Pending"}
                </span>
              </p>
              {invoice.notes && (
                <p>
                  <span className="text-[var(--text-muted)]">Notes: </span>
                  {invoice.notes}
                </p>
              )}
            </div>

            {status === "paid" || invoice.status === "paid" ? (
              <div className="mt-6 text-center">
                <Check className="mx-auto h-10 w-10 text-[var(--green)]" />
                <p className="mt-2 font-semibold">Payment confirmed</p>
              </div>
            ) : (
              <>
                {error && <p className="mt-4 text-sm text-[var(--red)]">{error}</p>}
                <button
                  type="button"
                  className="btn-primary mt-6 w-full"
                  disabled={!connected || status === "loading"}
                  onClick={pay}
                >
                  {status === "loading" ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                    </span>
                  ) : (
                    `Pay ${invoice.amountApt} APT`
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
