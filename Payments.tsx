import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatCard from '@/components/common/StatCard';
import StatusStamp, { paymentStatusTone } from '@/components/common/StatusStamp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  listOutstandingSales,
  listPayments,
  listVendorBalances,
  recordPayment,
} from '@/services/api';
import type { Payment, Sale, SettlementMethod, VendorBalance } from '@/types/types';
import {
  errorMessage,
  formatCurrency,
  formatDate,
  formatNumber,
  paymentMethodLabel,
  paymentStatusLabel,
  todayISO,
} from '@/lib/format';

const Payments = () => {
  const [balances, setBalances] = useState<VendorBalance[]>([]);
  const [outstanding, setOutstanding] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saleId, setSaleId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<SettlementMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balanceData, outstandingData, paymentData] = await Promise.all([
        listVendorBalances(),
        listOutstandingSales(),
        listPayments(),
      ]);
      setBalances(balanceData);
      setOutstanding(outstandingData);
      setPayments(paymentData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      balances.reduce(
        (acc, row) => ({
          billed: acc.billed + row.total_billed,
          paid: acc.paid + row.total_paid,
          outstanding: acc.outstanding + row.outstanding_balance,
        }),
        { billed: 0, paid: 0, outstanding: 0 },
      ),
    [balances],
  );

  const selectedSale = outstanding.find((sale) => String(sale.sale_id) === saleId) ?? null;

  const openDialog = (sale?: Sale) => {
    const target = sale ?? outstanding[0] ?? null;
    setSaleId(target ? String(target.sale_id) : '');
    setAmount(target ? (target.total_amount - target.amount_paid).toFixed(2) : '');
    setMethod('CASH');
    setPaymentDate(todayISO());
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!selectedSale) return setFormError('Select the sale being settled.');
    const value = Number(amount);
    const due = selectedSale.total_amount - selectedSale.amount_paid;
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      return setFormError('Payment amount must be greater than zero.');
    }
    if (value > due) {
      return setFormError(
        `Payment amount cannot exceed the outstanding balance of ${formatCurrency(due)}.`,
      );
    }

    setSaving(true);
    setFormError(null);
    try {
      const result = await recordPayment({
        sale_id: selectedSale.sale_id,
        amount: value,
        payment_method: method,
        payment_date: paymentDate,
      });
      toast.success(
        `Payment recorded. Sale #${selectedSale.sale_id} is now ${paymentStatusLabel(result.payment_status).toLowerCase()}.`,
      );
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Transactions"
        title="Vendor payments"
        description="Settle cash and mobile money payments, and track the credit still owed by each vendor."
        actions={
          <Button size="sm" onClick={() => openDialog()} disabled={outstanding.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Record payment
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total billed"
          value={formatCurrency(totals.billed)}
          hint="Value of all sales recorded"
          icon={Banknote}
        />
        <StatCard
          label="Total settled"
          value={formatCurrency(totals.paid)}
          hint="Cash and mobile money received"
          icon={Wallet}
        />
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(totals.outstanding)}
          hint="Credit still owed by vendors"
          icon={AlertTriangle}
          tone={totals.outstanding > 0 ? 'accent' : 'default'}
        />
      </div>

      <section className="paper-panel mt-6 min-w-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">Vendor balances</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Billed, settled and outstanding amounts per vendor
          </p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No vendor balances"
            description="Register vendors and record sales to start tracking balances."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Vendor</TableHead>
                  <TableHead className="whitespace-nowrap">Phone</TableHead>
                  <TableHead className="whitespace-nowrap">Location</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Sales</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Billed</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Paid</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((row) => (
                  <TableRow key={row.vendor_id}>
                    <TableCell className="whitespace-nowrap font-medium">{row.vendor_name}</TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {row.phone}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {row.location}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatNumber(row.sale_count)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatCurrency(row.total_billed)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                      {formatCurrency(row.total_paid)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      <span
                        className={
                          row.outstanding_balance > 0
                            ? 'font-semibold text-accent'
                            : 'text-muted-foreground'
                        }
                      >
                        {formatCurrency(row.outstanding_balance)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="paper-panel mt-6 min-w-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            Sales awaiting settlement
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Unpaid and partially paid sales, oldest first
          </p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : outstanding.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Every sale is settled"
            description="No vendor currently owes the depot money."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Sale</TableHead>
                  <TableHead className="whitespace-nowrap">Vendor</TableHead>
                  <TableHead className="whitespace-nowrap">Sale date</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Paid</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Due</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstanding.map((sale) => (
                  <TableRow key={sale.sale_id}>
                    <TableCell className="ledger-num whitespace-nowrap font-medium">
                      #{sale.sale_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{sale.vendor_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(sale.sale_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusStamp
                        label={paymentStatusLabel(sale.payment_status)}
                        tone={paymentStatusTone(sale.payment_status)}
                      />
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatCurrency(sale.total_amount)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                      {formatCurrency(sale.amount_paid)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right font-semibold text-accent">
                      {formatCurrency(sale.total_amount - sale.amount_paid)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openDialog(sale)}
                      >
                        Settle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="paper-panel mt-6 min-w-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">Payment history</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {payments.length} payment{payments.length === 1 ? '' : 's'} recorded
          </p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payments recorded"
            description="Payments recorded against sales will be listed here."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Payment</TableHead>
                  <TableHead className="whitespace-nowrap">Sale</TableHead>
                  <TableHead className="whitespace-nowrap">Vendor</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Method</TableHead>
                  <TableHead className="whitespace-nowrap">Note</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.payment_id}>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {payment.payment_id}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap font-medium">
                      #{payment.sale_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{payment.vendor_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(payment.payment_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="stamp">{paymentMethodLabel(payment.payment_method)}</span>
                    </TableCell>
                    <TableCell className="max-w-56 truncate whitespace-nowrap text-muted-foreground">
                      {payment.note || '—'}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Settle part or all of an outstanding sale with cash or mobile money.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="payment_sale">Sale</Label>
              <Select
                value={saleId}
                onValueChange={(value) => {
                  setSaleId(value);
                  const sale = outstanding.find((item) => String(item.sale_id) === value);
                  if (sale) setAmount((sale.total_amount - sale.amount_paid).toFixed(2));
                }}
              >
                <SelectTrigger id="payment_sale">
                  <SelectValue placeholder="Select an outstanding sale" />
                </SelectTrigger>
                <SelectContent>
                  {outstanding.map((sale) => (
                    <SelectItem key={sale.sale_id} value={String(sale.sale_id)}>
                      #{sale.sale_id} · {sale.vendor_name} ·{' '}
                      {formatCurrency(sale.total_amount - sale.amount_paid)} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSale ? (
              <div className="grid grid-cols-1 gap-3 border border-border bg-muted/40 p-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Total
                  </p>
                  <p className="ledger-num mt-1 text-sm font-medium">
                    {formatCurrency(selectedSale.total_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Paid
                  </p>
                  <p className="ledger-num mt-1 text-sm font-medium">
                    {formatCurrency(selectedSale.amount_paid)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Due
                  </p>
                  <p className="ledger-num mt-1 text-sm font-semibold text-accent">
                    {formatCurrency(selectedSale.total_amount - selectedSale.amount_paid)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payment_amount">Amount</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="ledger-num"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment_date">Payment date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment_method">Payment method</Label>
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as SettlementMethod)}
              >
                <SelectTrigger id="payment_method">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="MOBILE_MONEY">Mobile money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formError ? (
              <p className="break-words border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
