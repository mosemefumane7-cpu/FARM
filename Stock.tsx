import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Pencil,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listBatches, listStockLevels, updateStockThreshold } from '@/services/api';
import {
  PACKAGING_SIZES,
  type ExpiryStatus,
  type PackagingSize,
  type StockBatch,
  type StockRow,
} from '@/types/types';
import { errorMessage, formatDate, formatNumber, packagingLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

type BatchFilter = 'ALL' | 'EXPIRING_SOON' | 'EXPIRED';

const keyOf = (fruitId: number, size: PackagingSize) => `${fruitId}:${size}`;

const expiryCopy = (days: number) => {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'} left`;
};

const ExpiryBadge = ({ status, days }: { status: ExpiryStatus; days: number }) => {
  const config =
    status === 'EXPIRED'
      ? { label: 'Expired', icon: AlertTriangle, tone: 'border-destructive/60 text-destructive' }
      : status === 'EXPIRING_SOON'
        ? { label: 'Expiring soon', icon: Clock, tone: 'border-accent/70 text-accent' }
        : { label: 'Fresh', icon: CheckCircle2, tone: 'border-border text-muted-foreground' };
  const Icon = config.icon;

  return (
    <span className={cn('stamp gap-1', config.tone)}>
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
      <span className="sr-only"> — {expiryCopy(days)}</span>
    </span>
  );
};

const Stock = () => {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BatchFilter>('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [thresholdTarget, setThresholdTarget] = useState<StockRow | null>(null);
  const [thresholdValue, setThresholdValue] = useState('20');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stockData, batchData] = await Promise.all([listStockLevels(), listBatches('ALL')]);
      setRows(stockData);
      setBatches(batchData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const batchesByKey = useMemo(() => {
    const map = new Map<string, StockBatch[]>();
    batches.forEach((batch) => {
      const key = keyOf(batch.fruit_id, batch.packaging_size);
      const list = map.get(key) ?? [];
      list.push(batch);
      map.set(key, list);
    });
    return map;
  }, [batches]);

  const totals = useMemo(
    () => ({
      onHand: rows.reduce((sum, row) => sum + row.available_quantity, 0),
      saleable: rows.reduce((sum, row) => sum + row.saleable_quantity, 0),
      expiredBoxes: rows.reduce((sum, row) => sum + row.expired_quantity, 0),
      expiredBatches: batches.filter((batch) => batch.expiry_status === 'EXPIRED').length,
      expiringBatches: batches.filter((batch) => batch.expiry_status === 'EXPIRING_SOON').length,
    }),
    [rows, batches],
  );

  const visibleRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) =>
      (batchesByKey.get(keyOf(row.fruit_id, row.packaging_size)) ?? []).some(
        (batch) => batch.expiry_status === filter,
      ),
    );
  }, [rows, filter, batchesByKey]);

  const batchesFor = (row: StockRow) => {
    const list = batchesByKey.get(keyOf(row.fruit_id, row.packaging_size)) ?? [];
    return filter === 'ALL' ? list : list.filter((batch) => batch.expiry_status === filter);
  };

  const toggle = (row: StockRow) => {
    const key = keyOf(row.fruit_id, row.packaging_size);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openThreshold = (row: StockRow) => {
    setThresholdTarget(row);
    setThresholdValue(String(row.low_stock_threshold));
  };

  const saveThreshold = async () => {
    if (!thresholdTarget) return;
    const value = Number(thresholdValue);
    if (!Number.isInteger(value) || value < 0) {
      toast.error('Threshold must be a whole number of zero or more.');
      return;
    }
    setSaving(true);
    try {
      await updateStockThreshold(thresholdTarget.stock_id, value);
      toast.success('Low-stock threshold updated.');
      setThresholdTarget(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const filters: { value: BatchFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'All batches', count: batches.length },
    { value: 'EXPIRING_SOON', label: 'Expiring soon', count: totals.expiringBatches },
    { value: 'EXPIRED', label: 'Expired', count: totals.expiredBatches },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock & batch tracking"
        description="Every box is traced to an intake batch with its own expiration date. Sales consume the earliest-expiring batch first."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Boxes on hand"
          value={formatNumber(totals.onHand)}
          hint="Physical stock across all batches"
          icon={Boxes}
        />
        <StatCard
          label="Saleable boxes"
          value={formatNumber(totals.saleable)}
          hint="Excludes expired batches"
          icon={ShieldCheck}
        />
        <StatCard
          label="Expired boxes"
          value={formatNumber(totals.expiredBoxes)}
          hint={`${totals.expiredBatches} expired batch${totals.expiredBatches === 1 ? '' : 'es'}`}
          icon={AlertTriangle}
          tone={totals.expiredBoxes > 0 ? 'accent' : 'default'}
        />
        <StatCard
          label="Expiring soon"
          value={formatNumber(totals.expiringBatches)}
          hint="Batches expiring within 7 days"
          icon={Clock}
          tone={totals.expiringBatches > 0 ? 'accent' : 'default'}
        />
      </div>

      <section className="paper-panel mt-6 min-w-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-foreground">
              Stock matrix by packaging size
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Expand a row to see the batches that make up its balance
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {filters.map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span className="ledger-num ml-1.5 text-xs opacity-70">{item.count}</span>
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={filter === 'ALL' ? 'No stock records' : 'No batches match this filter'}
            description={
              filter === 'ALL'
                ? 'Register fruits and record a purchase to create stock batches.'
                : 'Switch back to all batches to see the full inventory.'
            }
            action={
              filter === 'ALL' ? undefined : (
                <Button variant="outline" size="sm" onClick={() => setFilter('ALL')}>
                  Show all batches
                </Button>
              )
            }
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 whitespace-nowrap" />
                  <TableHead className="whitespace-nowrap">Fruit</TableHead>
                  <TableHead className="whitespace-nowrap">Packaging</TableHead>
                  <TableHead className="whitespace-nowrap text-right">On hand</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Saleable</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Batches</TableHead>
                  <TableHead className="whitespace-nowrap">Earliest expiry</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const key = keyOf(row.fruit_id, row.packaging_size);
                  const isOpen = expanded.has(key);
                  const rowBatches = batchesFor(row);
                  const hasExpired = row.expired_batch_count > 0;

                  return (
                    <Fragment key={key}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggle(row)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} batches for ${row.fruit_name} ${packagingLabel(row.packaging_size)}`}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {row.fruit_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="stamp">{packagingLabel(row.packaging_size)}</span>
                        </TableCell>
                        <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                          {formatNumber(row.available_quantity)}
                        </TableCell>
                        <TableCell className="ledger-num whitespace-nowrap text-right">
                          <span
                            className={
                              row.saleable_quantity === 0
                                ? 'font-semibold text-destructive'
                                : 'text-foreground'
                            }
                          >
                            {formatNumber(row.saleable_quantity)}
                          </span>
                        </TableCell>
                        <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                          {formatNumber(row.batch_count)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.earliest_expiry ? formatDate(row.earliest_expiry) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {hasExpired ? (
                            <span className="stamp gap-1 border-destructive/60 text-destructive">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {row.expired_batch_count} expired
                            </span>
                          ) : row.is_low ? (
                            <span className="stamp gap-1 border-accent/70 text-accent">
                              <Clock className="h-3 w-3 shrink-0" />
                              Low stock
                            </span>
                          ) : (
                            <span className="stamp gap-1 border-border text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              Healthy
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => openThreshold(row)}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Threshold
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isOpen ? (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={9} className="p-0">
                            <div className="px-4 py-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Batches — {row.fruit_name} · {packagingLabel(row.packaging_size)}
                              </p>
                              {rowBatches.length === 0 ? (
                                <p className="border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                  No batch records exist for this fruit and packaging size. Record a
                                  purchase to create the first batch.
                                </p>
                              ) : (
                                <div className="w-full max-w-full overflow-x-auto border border-border bg-card">
                                  <Table className="[&>div]:max-w-full">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="whitespace-nowrap">
                                          Batch number
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Received
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">
                                          Expires
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap text-right">
                                          Received
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap text-right">
                                          Remaining
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {rowBatches.map((batch) => (
                                        <TableRow key={batch.batch_id}>
                                          <TableCell className="ledger-num whitespace-nowrap font-medium">
                                            {batch.batch_number}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap text-muted-foreground">
                                            {formatDate(batch.received_date)}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap">
                                            {formatDate(batch.expiry_date)}
                                            <span className="ml-2 text-xs text-muted-foreground">
                                              {expiryCopy(batch.days_until_expiry)}
                                            </span>
                                          </TableCell>
                                          <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                                            {formatNumber(batch.quantity_received)}
                                          </TableCell>
                                          <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                                            {formatNumber(batch.quantity_remaining)}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap">
                                            <ExpiryBadge
                                              status={batch.expiry_status}
                                              days={batch.days_until_expiry}
                                            />
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(thresholdTarget)}
        onOpenChange={(open) => !open && setThresholdTarget(null)}
      >
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-md">
          <DialogHeader>
            <DialogTitle>Low-stock threshold</DialogTitle>
            <DialogDescription>
              {thresholdTarget
                ? `${thresholdTarget.fruit_name} · ${packagingLabel(thresholdTarget.packaging_size)} packaging`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="threshold">Minimum saleable boxes</Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={thresholdValue}
              onChange={(event) => setThresholdValue(event.target.value)}
              className="ledger-num"
            />
            <p className="text-xs text-muted-foreground">
              The row is flagged as low stock when saleable boxes fall to or below this number.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveThreshold} disabled={saving}>
              {saving ? 'Saving…' : 'Save threshold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Stock;
