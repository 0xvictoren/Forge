"use client";

import { useEffect, useState } from "react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  description: string;
  amountApt: number;
  currency: string;
  status: string;
  createdAt: string;
  paymentUrl?: string;
}

export function InvoicePanel() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    description: "",
    amountApt: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []));

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountApt: Number(form.amountApt),
          status: "sent",
        }),
      });
      setForm({ clientName: "", clientEmail: "", description: "", amountApt: "", notes: "" });
      await load();
    } finally {
      setCreating(false);
    }
  };

  const copyPaymentLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <form onSubmit={create} className="card space-y-4 p-6">
        <h2 className="font-bold">Create invoice</h2>
        <input
          className="input"
          placeholder="Client name *"
          required
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
        />
        <input
          className="input"
          placeholder="Client email (optional)"
          value={form.clientEmail}
          onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
        />
        <input
          className="input"
          placeholder="Work description *"
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="input"
          type="number"
          step="0.01"
          placeholder="Amount (APT) *"
          required
          value={form.amountApt}
          onChange={(e) => setForm({ ...form, amountApt: e.target.value })}
        />
        <textarea
          className="input min-h-[80px]"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit" className="btn-primary w-full" disabled={creating}>
          {creating ? "Creating…" : "Create invoice"}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="mb-4 font-bold">Invoice history</h2>
        {!invoices.length ? (
          <p className="py-12 text-center text-[var(--text-muted)]">No invoices yet</p>
        ) : (
          <ul className="max-h-[70vh] space-y-3 overflow-auto">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="rounded-xl border border-[var(--border-dim)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{inv.invoiceNumber}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {inv.clientName} · {inv.description}
                    </p>
                    <p className="text-sm">
                      {inv.amountApt} {inv.currency} ·{" "}
                      <span
                        className={
                          inv.status === "paid" ? "text-green-600" : "text-[var(--brand)]"
                        }
                      >
                        {inv.status}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(inv.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href={`/api/invoices/${inv.id}/pdf`}
                      className="btn-ghost text-xs"
                      download
                    >
                      PDF
                    </a>
                    {inv.paymentUrl && (
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => copyPaymentLink(inv.paymentUrl!, inv.id)}
                      >
                        {copied === inv.id ? "Copied!" : "Copy link"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
