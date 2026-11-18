import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, CalendarRange, Trophy } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getRevenueByRange,
  getTopFruits,
  getTopVendors,
  listExpiringBatches,
  listStockLevels,
} from '@/services/api';
import {
  PACKAGING_SIZES,
  type PackagingSize,
  type RevenueRow,
  type ExpiringBatchRow,
  type StockRow,
  type TopFruitRow,
  type TopVendorRow,
} from '@/types/types';
import {
  errorMessage,
  formatCurrency,
  formatDate,
  formatNumber,
  packagingLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const todayISO = () => new Date().toISOString().slice(0, 10);

const Reports = () => {
  const [topFruits, setTopFruits] = useState<TopFruitRow[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendorRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [expiring, setExpiring] = useState<ExpiringBatchRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(firstOfYear());
  const [endDate, setEndDate] = useState(todayISO());

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fruitData, vendorData, stockData, expiringData] = await Promise.all([
        getTopFruits(5),
        getTopVendors(),
        listStockLevels(),
        listExpiringBatches(30),
      ]);
      setTopFruits(fruitData);
      setTopVendors(vendorData);
      setStock(stockData);
      setExpiring(expiringData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevenue = useCallback(async (start: string, end: string) => {
    setRevenueLoading(true);
    try {
      setRevenue(await getRevenueByRange(start, end));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadRevenue(startDate, endDate);
  }, [loadRevenue, startDate, endDate]);

  const revenueTotals = useMemo(
    () =>
      revenue.reduce(
        (acc, row) => ({
          revenue: acc.revenue + row.revenue,
          boxes: acc.boxes + row.boxes_sold,
          orders: acc.orders + row.order_count,
        }),
        { revenue: 0, boxes: 0, orders: 0 },
      ),
    [revenue],
  );

  const maxFruitBoxes = topFruits.reduce((max, row) => Math.max(max, row.total_boxes), 0) || 1;
  const maxVendorBoxes = topVendors.reduce((max, row) => Math.max(max, row.total_boxes), 0) || 1;

  const stockMatrix = useMemo(() => {
    const map = new Map<number, { fruit_id: number; fruit_name: string; cells: Record<PackagingSize, StockRow | undefined> }>();
    stock.forEach((row) => {
      if (!map.has(row.fruit_id)) {
        map.set(row.fruit_id, {
          fruit_id: row.fruit_id,
          fruit_name: row.fruit_name,
          cells: { SMALL: undefined, MEDIUM: undefined, LARGE: undefined },
        });
      }
      const entry = map.get(row.fruit_id);
      if (entry) entry.cells[row.packaging_size] = row;
    });
    return Array.from(map.values());
  }, [stock]);

  return (
    <div>
      <PageHeader
        eyebrow="Analysis"
        title="Business reports"
        description="The four reporting queries required by the distribution operation: best sellers, revenue by period, vendor volume and live stock."
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <section className="paper-panel min-w-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-foreground">
              Five most frequently sold fruits
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Ranked by total boxes sold</p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : topFruits.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No sales data"
            description="Record sales to populate the best-selling fruits report."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Rank</TableHead>
                  <TableHead className="whitespace-nowrap">Fruit</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Boxes sold</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Orders</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Revenue</TableHead>
                  <TableHead className="min-w-[160px] whitespace-nowrap">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topFruits.map((row, index) => (
                  <TableRow key={row.fruit_id}>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{row.fruit_name}</TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatNumber(row.total_boxes)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                      {formatNumber(row.order_count)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatCurrency(row.total_revenue)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="h-1.5 w-full min-w-32 bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.max(6, (row.total_boxes / maxFruitBoxes) * 100)}%` }}
                        />
                      </div>
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
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-foreground">
              Sales revenue for a date range
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Total revenue generated between the selected dates
          </p>
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-end">
          <div className="space-y-1.5 md:w-44">
            <Label htmlFor="start_date">Start date</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:w-44">
            <Label htmlFor="end_date">End date</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 md:mb-0"
            onClick={() => void loadRevenue(startDate, endDate)}
            disabled={revenueLoading}
          >
            {revenueLoading ? 'Loading…' : 'Apply range'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 border-b border-border px-4 py-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total revenue
            </p>
            <p className="ledger-num mt-1 font-display text-lg font-semibold text-foreground">
              {formatCurrency(revenueTotals.revenue)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Boxes sold
            </p>
            <p className="ledger-num mt-1 font-display text-lg font-semibold text-foreground">
              {formatNumber(revenueTotals.boxes)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Trading days
            </p>
            <p className="ledger-num mt-1 font-display text-lg font-semibold text-foreground">
              {formatNumber(revenue.length)}
            </p>
          </div>
        </div>

        {revenueLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : revenue.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No sales in this period"
            description="Adjust the date range to include days with recorded sales."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Orders</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Boxes</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenue.map((row) => (
                  <TableRow key={row.report_date}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatDate(row.report_date)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                      {formatNumber(row.order_count)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatNumber(row.boxes_sold)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                      {formatCurrency(row.revenue)}
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
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-foreground">
              Vendors ranked by boxes purchased
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Highest volume buyers across all packaging sizes
          </p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : topVendors.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No vendor activity"
            description="Record sales to rank vendors by purchase volume."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Rank</TableHead>
                  <TableHead className="whitespace-nowrap">Vendor</TableHead>
                  <TableHead className="whitespace-nowrap">Phone</TableHead>
                  <TableHead className="whitespace-nowrap">Location</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Boxes</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Orders</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Value</TableHead>
                  <TableHead className="min-w-[140px] whitespace-nowrap">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendors.map((row, index) => (
                  <TableRow key={row.vendor_id}>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{row.vendor_name}</TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {row.phone}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {row.location}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                      {formatNumber(row.total_boxes)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right text-muted-foreground">
                      {formatNumber(row.order_count)}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right">
                      {formatCurrency(row.total_value)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="h-1.5 w-full min-w-24 bg-muted">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${Math.max(4, (row.total_boxes / maxVendorBoxes) * 100)}%` }}
                        />
                      </div>
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
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-foreground">
              Current stock levels
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Available boxes for every fruit and packaging size
          </p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : stockMatrix.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No stock records"
            description="Register fruits to create packaging-specific stock records."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fruit</TableHead>
                  {PACKAGING_SIZES.map((size) => (
                    <TableHead key={size} className="whitespace-nowrap text-right">
                      {packagingLabel(size)}
                    </TableHead>
                  ))}
                  <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockMatrix.map((row) => {
                  const total = PACKAGING_SIZES.reduce(
                    (sum, size) => sum + (row.cells[size]?.available_quantity ?? 0),
                    0,
                  );
                  return (
                    <TableRow key={row.fruit_id}>
                      <TableCell className="whitespace-nowrap font-medium">{row.fruit_name}</TableCell>
                      {PACKAGING_SIZES.map((size) => {
                        const cell = row.cells[size];
                        return (
                          <TableCell key={size} className="whitespace-nowrap text-right">
                            <span
                              className={cn(
                                'ledger-num inline-flex min-w-14 items-center justify-end gap-1 px-1.5 py-0.5',
                                cell?.is_low
                                  ? 'border border-destructive/50 font-semibold text-destructive'
                                  : 'text-foreground',
                              )}
                            >
                              {cell?.is_low ? <AlertTriangle className="h-3 w-3" /> : null}
                              {cell ? formatNumber(cell.available_quantity) : '—'}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                        {formatNumber(total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="paper-panel mt-6 min-w-0">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-foreground">
              Batches expiring within 30 days
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ordered by expiry date — these batches are consumed first
            </p>
          </div>
          <span className="stamp shrink-0">{expiring.length} batches</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : expiring.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No batches expire within the next 30 days.
          </p>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Batch number</TableHead>
                  <TableHead className="whitespace-nowrap">Fruit</TableHead>
                  <TableHead className="whitespace-nowrap">Packaging</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Boxes left</TableHead>
                  <TableHead className="whitespace-nowrap">Expiry date</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiring.map((batch) => (
                  <TableRow key={batch.batch_id}>
                    <TableCell className="ledger-num whitespace-nowrap font-medium">
                      {batch.batch_number}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{batch.fruit_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="stamp">{packagingLabel(batch.packaging_size)}</span>
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-right font-medium">
                      {formatNumber(batch.quantity_remaining)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(batch.expiry_date)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {batch.days_until_expiry < 0
                          ? `${Math.abs(batch.days_until_expiry)}d overdue`
                          : batch.days_until_expiry === 0
                            ? 'today'
                            : `${batch.days_until_expiry}d left`}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {batch.expiry_status === 'EXPIRED' ? (
                        <span className="stamp gap-1 border-destructive/60 text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Expired
                        </span>
                      ) : (
                        <span className="stamp gap-1 border-accent/70 text-accent">
                          <CalendarRange className="h-3 w-3 shrink-0" />
                          Expiring soon
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Reports;
