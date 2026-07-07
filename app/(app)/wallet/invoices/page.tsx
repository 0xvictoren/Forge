import Link from "next/link";
import { InvoicePanel } from "@/components/wallet/invoice-panel";

export default function InvoicesPage() {
  return (
    <div>
      <div className="border-b border-[var(--border-dim)] bg-[var(--bg-elevated)] px-4 py-4 lg:px-8 -mx-4 lg:-mx-8">
        <div className="mx-auto max-w-[1400px]">
          <Link href="/wallet" className="text-sm text-[var(--brand)]">
            ← Wallet
          </Link>
          <h1 className="mt-2 text-xl font-bold">Invoices</h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] py-8">
        <InvoicePanel />
      </div>
    </div>
  );
}
