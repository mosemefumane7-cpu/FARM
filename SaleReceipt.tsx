import type { Sale, SaleDetail } from '@/types/types';
import { formatCurrency, formatDate, formatNumber, packagingLabel } from '@/lib/format';
import { paymentMethodLabel, paymentStatusLabel, receiptNumber } from '@/lib/receipt';

interface SaleReceiptProps {
  sale: Sale;
  details: SaleDetail[];
  vendorLocation?: string;
}

const SaleReceipt = ({ sale, details, vendorLocation }: SaleReceiptProps) => {
  const balance = Math.max(sale.total_amount - sale.amount_paid, 0);
  const lineCount = details.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <article className="receipt-sheet mx-auto w-full max-w-[210mm] bg-card p-6 text-foreground md:p-10">
      <header className="flex flex-col gap-3 border-b-2 border-foreground/80 pb-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.16em] md:text-2xl">
            Batloung Farm
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Fruit Distribution · Maseru, Lesotho
          </p>
          <p className="text-xs text-muted-foreground">Sales receipt</p>
        </div>
        <div className="shrink-0 md:text-right">
          <p className="ledger-num text-sm font-semibold">{receiptNumber(sale.sale_id, sale.sale_date)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Issued {formatDate(sale.sale_date)}</p>
          <p className="text-xs text-muted-foreground">Sale #{sale.sale_id}</p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 border-b border-border py-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Billed to
          </p>
          <p className="mt-1 break-words text-sm font-semibold">{sale.vendor_name}</p>
          {sale.vendor_phone ? (
            <p className="ledger-num text-xs text-muted-foreground">{sale.vendor_phone}</p>
          ) : null}
          {vendorLocation ? (
            <p className="break-words text-xs text-muted-foreground">{vendorLocation}</p>
          ) : null}
        </div>
        <div className="min-w-0 md:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Payment
          </p>
          <p className="mt-1 text-sm font-semibold">{paymentMethodLabel(sale.payment_method)}</p>
          <p className="text-xs text-muted-foreground">{paymentStatusLabel(sale.payment_status)}</p>
        </div>
      </section>

      <section className="py-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Item
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Qty
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Unit price
              </th>
              <th className="py-2 pl-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {details.map((line) => (
              <tr key={line.sale_detail_id} className="border-b border-border/60">
                <td className="py-2 pr-2">
                  <span className="font-medium">{line.fruit_name}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {packagingLabel(line.packaging_size)}
                  </span>
                </td>
                <td className="ledger-num px-2 py-2 text-right">{formatNumber(line.quantity)}</td>
                <td className="ledger-num px-2 py-2 text-right">
                  {formatCurrency(line.unit_price)}
                </td>
                <td className="ledger-num py-2 pl-2 text-right font-medium">
                  {formatCurrency(line.quantity * line.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          {details.length} line{details.length === 1 ? '' : 's'} · {formatNumber(lineCount)} boxes
        </p>
      </section>

      <section className="ml-auto w-full max-w-sm border-t-2 border-foreground/80 pt-3">
        <div className="flex items-center justify-between py-1 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="ledger-num font-semibold">{formatCurrency(sale.total_amount)}</span>
        </div>
        <div className="flex items-center justify-between py-1 text-sm">
          <span className="text-muted-foreground">Amount paid</span>
          <span className="ledger-num">{formatCurrency(sale.amount_paid)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="font-semibold">Balance due</span>
          <span className="ledger-num font-bold">{formatCurrency(balance)}</span>
        </div>
      </section>

      <footer className="mt-6 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Thank you for your business. Please retain this receipt for your records.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Goods sold are subject to the farm's freshness policy. Expired stock is never sold.
        </p>
      </footer>
    </article>
  );
};

export default SaleReceipt;
