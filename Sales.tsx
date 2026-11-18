import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Plus, Printer, ReceiptText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatusStamp, { paymentStatusTone } from '@/components/common/StatusStamp';
import SaleReceipt from '@/components/receipts/SaleReceipt';
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
  createSale,
  listFruitPrices,
  listFruits,
  listSaleDetails,
  listSales,
  listStockLevels,
  listVendors,
} from '@/services/api';
import { receiptNumber } from '@/lib/receipt';
import {
  PACKAGING_SIZES,
  type Fruit,
  type FruitPrice,
  type PackagingSize,
  type PaymentMethod,
  type Sale,
  type SaleDetail,
  type StockRow,
  type Vendor,
} from '@/types/types';
import {
  errorMessage,
  formatCurrency,
  formatDate,
  formatNumber,
  packagingLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  todayISO,
} from '@/lib/format';

interface LineDraft {
  key: string;
  fruit_id: string;
  packaging_size: PackagingSize;
  quantity: string;
  unit_price: string;
}

let lineCounter = 0;
const newLine = (): LineDraft => {
  lineCounter += 1;
  return {
    key: `sale-line-${lineCounter}`,
    fruit_id: '',
    packaging_size: 'MEDIUM',
    quantity: '',
    unit_price: '',
  };
};

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [prices, setPrices] = useState<FruitPrice[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [saleDate, setSaleDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState<Sale | null>(null);
  const [detailLines, setDetailLines] = useState<SaleDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptLines, setReceiptLines] = useState<SaleDetail[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [saleData, vendorData, fruitData, priceData, stockData] = await Promise.all([
        listSales(),
        listVendors(),
        listFruits(),
        listFruitPrices(),
        listStockLevels(),
      ]);
      setSales(saleData);
      setVendors(vendorData);
      setFruits(fruitData);
      setPrices(priceData);
      setStock(stockData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    prices.forEach((price) => map.set(`${price.fruit_id}:${price.packaging_size}`, price.selling_price));
    return map;
  }, [prices]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stock.forEach((row) => map.set(`${row.fruit_id}:${row.packaging_size}`, row.available_quantity));
    return map;
  }, [stock]);

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity);
        const price = Number(line.unit_price);
        if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
        return sum + qty * price;
      }, 0),
    [lines],
  );

  const openCreate = () => {
    setVendorId('');
    setSaleDate(todayISO());
    setPaymentMethod('CASH');
    setLines([newLine()]);
    setFormError(null);
    setCreateOpen(true);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const applyDefaultPrice = (line: LineDraft, fruitId: string, size: PackagingSize) => {
    const price = priceMap.get(`${fruitId}:${size}`);
    return price ? price.toFixed(2) : line.unit_price;
  };

  const submit = async () => {
    if (!vendorId) return setFormError('Select the vendor buying the fruit.');
    if (!saleDate) return setFormError('Select the sale date.');
    if (lines.length === 0) return setFormError('Please add at least one fruit line item.');

    const items = [];
    for (const [index, line] of lines.entries()) {
      if (!line.fruit_id) return setFormError(`Line ${index + 1}: select a fruit.`);
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return setFormError(`Line ${index + 1}: quantity must be a positive whole number.`);
      }
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return setFormError(`Line ${index + 1}: unit selling price must be greater than zero.`);
      }
      items.push({
        fruit_id: Number(line.fruit_id),
        packaging_size: line.packaging_size,
        quantity,
        unit_price: unitPrice,
      });
    }

    setSaving(true);
    setFormError(null);
    try {
      const result = await createSale({
        vendor_id: Number(vendorId),
        sale_date: saleDate,
        payment_method: paymentMethod,
        items,
      });
      const vendor = vendors.find((item) => item.vendor_id === Number(vendorId));
      const newReceiptLines: SaleDetail[] = lines.map((line, index) => ({
        sale_detail_id: index + 1,
        sale_id: result.sale_id,
        fruit_id: Number(line.fruit_id),
        packaging_size: line.packaging_size,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        fruit_name:
          fruits.find((fruit) => fruit.fruit_id === Number(line.fruit_id))?.fruit_name ??
          'Unknown fruit',
      }));

      toast.success(
        `Sale #${result.sale_id} recorded for ${formatCurrency(result.total_amount)}. Stock reduced.`,
      );
      setCreateOpen(false);
      setReceiptSale({
        sale_id: result.sale_id,
        vendor_id: Number(vendorId),
        sale_date: saleDate,
        payment_status: result.payment_status,
        payment_method: paymentMethod,
        total_amount: result.total_amount,
        amount_paid: paymentMethod === 'CREDIT' ? 0 : result.total_amount,
        created_at: new Date().toISOString(),
        vendor_name: vendor?.vendor_name ?? 'Unknown vendor',
        vendor_phone: vendor?.phone ?? '',
      });
      setReceiptLines(newReceiptLines);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (sale: Sale) => {
    setDetailTarget(sale);
    setDetailLoading(true);
    setDetailLines([]);
    try {
      setDetailLines(await listSaleDetails(sale.sale_id));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const openReceiptFor = async (sale: Sale) => {
    try {
      const lines = await listSaleDetails(sale.sale_id);
      setReceiptSale(sale);
      setReceiptLines(lines);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Transactions"
        title="Sales management"
        description="Record multi-item sales to vendors. Stock is validated atomically — if any line is short, the whole sale is rejected."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Record sale
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <section className="paper-panel min-w-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">Sales register</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sales.length} sale{sales.length === 1 ? '' : 's'} recorded
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No sales recorded"
            description="Record a sale to a registered vendor to start tracking revenue and balances."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Record sale
              </Button>
            }
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Sale</TableHead>
                  <TableHead className="whitespace-nowrap">Vendor</TableHead>
                  <TableHead className="whitespace-nowrap">Sale date</TableHead>
                  <TableHead className="whitespace-nowrap">Method</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Outstanding</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const outstanding = sale.total_amount - sale.amount_paid;
                  return (
                    <TableRow key={sale.sale_id}>
                      <TableCell className="ledger-num whitespace-nowrap font-medium">
                        #{sale.sale_id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{sale.vendor_name}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(sale.sale_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {paymentMethodLabel(sale.payment_method)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusStamp
                          label={paymentStatusLabel(sale.payment_status)}
                          tone={paymentStatusTone(sale.payment_status)}
                        />
                      </TableCell>
                      <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                        {formatCurrency(sale.total_amount)}
                      </TableCell>
                      <TableCell className="ledger-num whitespace-nowrap text-right">
                        <span className={outstanding > 0 ? 'font-semibold text-accent' : 'text-muted-foreground'}>
                          {formatCurrency(outstanding)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => void openDetail(sale)}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Lines
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Record sale</DialogTitle>
            <DialogDescription>
              Add every fruit line sold. Totals are calculated automatically and stock is deducted
              only when every line is available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale_vendor">Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger id="sale_vendor">
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.vendor_id} value={String(vendor.vendor_id)}>
                        {vendor.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale_date">Sale date</Label>
                <Input
                  id="sale_date"
                  type="date"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale_method">Payment method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                >
                  <SelectTrigger id="sale_method">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="MOBILE_MONEY">Mobile money</SelectItem>
                    <SelectItem value="CREDIT">Credit (outstanding)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Fruit lines
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => setLines((current) => [...current, newLine()])}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => {
                  const available = line.fruit_id
                    ? stockMap.get(`${line.fruit_id}:${line.packaging_size}`) ?? 0
                    : null;
                  const requested = Number(line.quantity) || 0;
                  const short = available !== null && requested > available;
                  return (
                    <div key={line.key} className="border border-border bg-muted/40 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Line {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            setLines((current) =>
                              current.length === 1
                                ? current
                                : current.filter((item) => item.key !== line.key),
                            )
                          }
                          disabled={lines.length === 1}
                          aria-label={`Remove line ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="space-y-1.5">
                          <Label htmlFor={`sale-fruit-${line.key}`}>Fruit</Label>
                          <Select
                            value={line.fruit_id}
                            onValueChange={(value) =>
                              updateLine(line.key, {
                                fruit_id: value,
                                unit_price: applyDefaultPrice(line, value, line.packaging_size),
                              })
                            }
                          >
                            <SelectTrigger id={`sale-fruit-${line.key}`}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {fruits.map((fruit) => (
                                <SelectItem key={fruit.fruit_id} value={String(fruit.fruit_id)}>
                                  {fruit.fruit_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`sale-size-${line.key}`}>Packaging</Label>
                          <Select
                            value={line.packaging_size}
                            onValueChange={(value) =>
                              updateLine(line.key, {
                                packaging_size: value as PackagingSize,
                                unit_price: applyDefaultPrice(line, line.fruit_id, value as PackagingSize),
                              })
                            }
                          >
                            <SelectTrigger id={`sale-size-${line.key}`}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {PACKAGING_SIZES.map((size) => (
                                <SelectItem key={size} value={size}>
                                  {packagingLabel(size)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`sale-qty-${line.key}`}>Boxes</Label>
                          <Input
                            id={`sale-qty-${line.key}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            placeholder="0"
                            className="ledger-num"
                            aria-invalid={short}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`sale-price-${line.key}`}>Unit price</Label>
                          <Input
                            id={`sale-price-${line.key}`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={line.unit_price}
                            onChange={(event) => updateLine(line.key, { unit_price: event.target.value })}
                            placeholder="0.00"
                            className="ledger-num"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {available === null
                            ? 'Select a fruit and packaging size to see available stock.'
                            : short
                              ? `Only ${formatNumber(available)} boxes available — this line will be rejected.`
                              : `${formatNumber(available)} boxes available`}
                        </p>
                        <p className="ledger-num text-xs text-muted-foreground">
                          Line subtotal{' '}
                          <span className="font-semibold text-foreground">
                            {formatCurrency(
                              (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Total amount payable
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {paymentMethod === 'CREDIT'
                    ? 'Recorded as an outstanding balance for this vendor.'
                    : 'Settled at the point of sale.'}
                </p>
              </div>
              <p className="ledger-num shrink-0 font-display text-lg font-semibold text-foreground">
                {formatCurrency(total)}
              </p>
            </div>

            {formError ? (
              <p className="break-words border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Recording…' : 'Record sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailTarget)} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale #{detailTarget?.sale_id}</DialogTitle>
            <DialogDescription>
              {detailTarget
                ? `${detailTarget.vendor_name} · ${formatDate(detailTarget.sale_date)} · ${paymentMethodLabel(detailTarget.payment_method)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="[&>div]:max-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Fruit</TableHead>
                    <TableHead className="whitespace-nowrap">Packaging</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Boxes</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Unit price</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLines.map((line) => (
                    <TableRow key={line.sale_detail_id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {line.fruit_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="stamp">{packagingLabel(line.packaging_size)}</span>
                      </TableCell>
                      <TableCell className="ledger-num whitespace-nowrap text-right">
                        {formatNumber(line.quantity)}
                      </TableCell>
                      <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                        {formatCurrency(line.unit_price)}
                      </TableCell>
                      <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                        {formatCurrency(line.quantity * line.unit_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="ledger-num text-sm font-semibold text-foreground">
                {formatCurrency(detailTarget?.total_amount ?? 0)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="ledger-num text-sm text-foreground">
                {formatCurrency(detailTarget?.amount_paid ?? 0)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="ledger-num text-sm font-semibold text-accent">
                {formatCurrency(
                  (detailTarget?.total_amount ?? 0) - (detailTarget?.amount_paid ?? 0),
                )}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">Status</p>
              {detailTarget ? (
                <StatusStamp
                  label={paymentStatusLabel(detailTarget.payment_status)}
                  tone={paymentStatusTone(detailTarget.payment_status)}
                />
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTarget(null)}>
              Close
            </Button>
            <Button
              disabled={detailLoading || !detailTarget}
              onClick={() => {
                if (!detailTarget) return;
                setReceiptSale(detailTarget);
                setReceiptLines(detailLines);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receiptSale)} onOpenChange={(open) => !open && setReceiptSale(null)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Receipt{' '}
              {receiptSale ? receiptNumber(receiptSale.sale_id, receiptSale.sale_date) : ''}
            </DialogTitle>
            <DialogDescription>Review the receipt, then print it for the vendor.</DialogDescription>
          </DialogHeader>

          {receiptSale ? (
            <div className="border border-border">
              <SaleReceipt
                sale={receiptSale}
                details={receiptLines}
                vendorLocation={
                  vendors.find((item) => item.vendor_id === receiptSale.vendor_id)?.location
                }
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptSale(null)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {receiptSale ? (
        <div className="receipt-print-root">
          <SaleReceipt
            sale={receiptSale}
            details={receiptLines}
            vendorLocation={
              vendors.find((item) => item.vendor_id === receiptSale.vendor_id)?.location
            }
          />
        </div>
      ) : null}
    </div>
  );
};

export default Sales;
