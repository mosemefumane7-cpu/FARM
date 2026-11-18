import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
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
  createPurchase,
  suggestBatchNumbers,
  listFruits,
  listPurchaseDetails,
  listPurchases,
  listSuppliers,
} from '@/services/api';
import {
  PACKAGING_SIZES,
  type Fruit,
  type PackagingSize,
  type Purchase,
  type PurchaseDetail,
  type Supplier,
} from '@/types/types';
import {
  errorMessage,
  formatCurrency,
  formatDate,
  formatNumber,
  packagingLabel,
  todayISO,
} from '@/lib/format';

interface LineDraft {
  key: string;
  fruit_id: string;
  packaging_size: PackagingSize;
  quantity: string;
  unit_cost: string;
  batch_number: string;
  expiry_date: string;
}

let lineCounter = 0;
const newLine = (): LineDraft => {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    fruit_id: '',
    packaging_size: 'MEDIUM',
    quantity: '',
    unit_cost: '',
    batch_number: '',
    expiry_date: '',
  };
};

const Purchases = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [batchSuggestions, setBatchSuggestions] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState<Purchase | null>(null);
  const [detailLines, setDetailLines] = useState<PurchaseDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [purchaseData, supplierData, fruitData] = await Promise.all([
        listPurchases(),
        listSuppliers(),
        listFruits(),
      ]);
      setPurchases(purchaseData);
      setSuppliers(supplierData);
      setFruits(fruitData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pre-fill each line with a unique batch number suggestion for the chosen date.
  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    suggestBatchNumbers(purchaseDate || todayISO(), 20)
      .then((suggestions) => {
        if (cancelled) return;
        setBatchSuggestions(suggestions);
        setLines((current) =>
          current.map((line, index) => ({
            ...line,
            batch_number: suggestions[index] ?? line.batch_number,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [createOpen, purchaseDate]);

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity);
        const cost = Number(line.unit_cost);
        if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
        return sum + qty * cost;
      }, 0),
    [lines],
  );

  const openCreate = () => {
    setSupplierId('');
    setPurchaseDate(todayISO());
    setLines([newLine()]);
    setFormError(null);
    setCreateOpen(true);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const submit = async () => {
    if (!supplierId) return setFormError('Select the supplier this purchase was made from.');
    if (!purchaseDate) return setFormError('Select the purchase date.');
    if (lines.length === 0) return setFormError('Please add at least one fruit line item.');

    const items = [];
    for (const [index, line] of lines.entries()) {
      if (!line.fruit_id) return setFormError(`Line ${index + 1}: select a fruit.`);
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unit_cost);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return setFormError(`Line ${index + 1}: quantity must be a positive whole number.`);
      }
      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        return setFormError(`Line ${index + 1}: unit cost must be greater than zero.`);
      }
      if (!line.expiry_date) {
        return setFormError(`Line ${index + 1}: an expiration date is required.`);
      }
      if (line.expiry_date < purchaseDate) {
        return setFormError(
          `Line ${index + 1}: expiration date cannot be before the purchase date.`,
        );
      }
      items.push({
        fruit_id: Number(line.fruit_id),
        packaging_size: line.packaging_size,
        quantity,
        unit_cost: unitCost,
        batch_number: line.batch_number.trim(),
        expiry_date: line.expiry_date,
      });
    }

    setSaving(true);
    setFormError(null);
    try {
      const result = await createPurchase({
        supplier_id: Number(supplierId),
        purchase_date: purchaseDate,
        items,
      });
      toast.success(
        `Purchase #${result.purchase_id} recorded for ${formatCurrency(result.total_amount)}. Stock updated.`,
      );
      setCreateOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (purchase: Purchase) => {
    setDetailTarget(purchase);
    setDetailLoading(true);
    setDetailLines([]);
    try {
      setDetailLines(await listPurchaseDetails(purchase.purchase_id));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Transactions"
        title="Purchase management"
        description="Record fruit intake from suppliers. Each purchase accepts multiple fruit lines and raises the matching packaging stock automatically."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Record purchase
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
          <h2 className="font-display text-base font-semibold text-foreground">Purchase register</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {purchases.length} purchase{purchases.length === 1 ? '' : 's'} recorded
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchases recorded"
            description="Record a purchase from a supplier to bring fruit into the depot."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Record purchase
              </Button>
            }
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Purchase</TableHead>
                  <TableHead className="whitespace-nowrap">Supplier</TableHead>
                  <TableHead className="whitespace-nowrap">Purchase date</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total amount</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.purchase_id}>
                    <TableCell className="ledger-num whitespace-nowrap font-medium">
                      #{purchase.purchase_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{purchase.supplier_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(purchase.purchase_date)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                      {formatCurrency(purchase.total_amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => void openDetail(purchase)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Lines
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Record purchase</DialogTitle>
            <DialogDescription>
              Add every fruit line received. The total is calculated automatically and stock is
              raised in a single transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="purchase_supplier">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="purchase_supplier">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.supplier_id} value={String(supplier.supplier_id)}>
                        {supplier.business_name} · {supplier.province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purchase_date">Purchase date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
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
                  onClick={() =>
                    setLines((current) => {
                      const next = newLine();
                      next.batch_number = batchSuggestions[current.length] ?? '';
                      return [...current, next];
                    })
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
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
                        <Label htmlFor={`fruit-${line.key}`}>Fruit</Label>
                        <Select
                          value={line.fruit_id}
                          onValueChange={(value) => updateLine(line.key, { fruit_id: value })}
                        >
                          <SelectTrigger id={`fruit-${line.key}`}>
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
                        <Label htmlFor={`size-${line.key}`}>Packaging</Label>
                        <Select
                          value={line.packaging_size}
                          onValueChange={(value) =>
                            updateLine(line.key, { packaging_size: value as PackagingSize })
                          }
                        >
                          <SelectTrigger id={`size-${line.key}`}>
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
                        <Label htmlFor={`qty-${line.key}`}>Boxes</Label>
                        <Input
                          id={`qty-${line.key}`}
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                          placeholder="0"
                          className="ledger-num"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`cost-${line.key}`}>Unit cost</Label>
                        <Input
                          id={`cost-${line.key}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={line.unit_cost}
                          onChange={(event) => updateLine(line.key, { unit_cost: event.target.value })}
                          placeholder="0.00"
                          className="ledger-num"
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`batch-${line.key}`}>Batch number</Label>
                        <Input
                          id={`batch-${line.key}`}
                          value={line.batch_number}
                          onChange={(event) =>
                            updateLine(line.key, { batch_number: event.target.value })
                          }
                          placeholder="Auto-generated if left blank"
                          className="ledger-num"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`expiry-${line.key}`}>Expiration date</Label>
                        <Input
                          id={`expiry-${line.key}`}
                          type="date"
                          value={line.expiry_date}
                          onChange={(event) =>
                            updateLine(line.key, { expiry_date: event.target.value })
                          }
                        />
                      </div>
                    </div>
                    <p className="ledger-num mt-2 text-right text-xs text-muted-foreground">
                      Line subtotal{' '}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(
                          (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0),
                        )}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total purchase amount
              </p>
              <p className="ledger-num font-display text-lg font-semibold text-foreground">
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
              {saving ? 'Recording…' : 'Record purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailTarget)} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase #{detailTarget?.purchase_id}</DialogTitle>
            <DialogDescription>
              {detailTarget
                ? `${detailTarget.supplier_name} · ${formatDate(detailTarget.purchase_date)}`
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
                    <TableHead className="whitespace-nowrap text-right">Unit cost</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLines.map((line) => (
                    <TableRow key={line.purchase_detail_id}>
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
                        {formatCurrency(line.unit_cost)}
                      </TableCell>
                      <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                        {formatCurrency(line.quantity * line.unit_cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total
            </p>
            <p className="ledger-num font-display text-base font-semibold text-foreground">
              {formatCurrency(detailTarget?.total_amount ?? 0)}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchases;
