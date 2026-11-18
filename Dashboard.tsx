import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Clock,
  ReceiptText,
  ShoppingCart,
  Store,
  Wallet,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import StatusStamp, { paymentStatusTone } from '@/components/common/StatusStamp';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
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
  getDashboardMetrics,
  getTopFruits,
  listSales,
  listStockLevels,
} from '@/services/api';
import type { DashboardMetrics, Sale, StockRow, TopFruitRow } from '@/types/types';
import {
  errorMessage,
  formatCurrency,
  formatDate,
  formatNumber,
  packagingLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/format';

const Dashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [topFruits, setTopFruits] = useState<TopFruitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, salesData, stockData, fruitData] = await Promise.all([
        getDashboardMetrics(),
        listSales(),
        listStockLevels(),
        getTopFruits(5),
      ]);
      setMetrics(metricsData);
      setRecentSales(salesData.slice(0, 6));
      setLowStock(stockData.filter((row) => row.is_low));
      setTopFruits(fruitData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxBoxes = topFruits.reduce((max, row) => Math.max(max, row.total_boxes), 0) || 1;

  return (
    <div>
      <PageHeader
        eyebrow="Operations ledger"
        title="Distribution overview"
        description="Live position of fruit stock, supplier intake, vendor sales and outstanding credit across the Maseru depot."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/purchases">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Record purchase
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/sales">
                <ReceiptText className="mr-2 h-4 w-4" />
                Record sale
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">Could not load the dashboard</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {loading || !metrics
          ? Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))
          : [
              {
                label: 'Sales revenue',
                value: formatCurrency(metrics.total_revenue),
                hint: `${formatNumber(metrics.sale_count)} sales recorded`,
                icon: CircleDollarSign,
                tone: 'default' as const,
              },
              {
                label: 'Purchase spend',
                value: formatCurrency(metrics.total_purchases),
                hint: `${formatNumber(metrics.purchase_count)} purchases from suppliers`,
                icon: ShoppingCart,
                tone: 'default' as const,
              },
              {
                label: 'Stock on hand',
                value: `${formatNumber(metrics.total_stock_boxes)} boxes`,
                hint: `${formatNumber(metrics.active_fruit_count)} active fruits × 3 packaging sizes`,
                icon: Boxes,
                tone: 'default' as const,
              },
              {
                label: 'Low-stock alerts',
                value: formatNumber(metrics.low_stock_count),
                hint: 'Fruit and size combinations at or below threshold',
                icon: AlertTriangle,
                tone: metrics.low_stock_count > 0 ? ('alert' as const) : ('default' as const),
              },
              {
                label: 'Outstanding balances',
                value: formatCurrency(metrics.total_outstanding),
                hint: 'Credit still owed by vendors',
                icon: Wallet,
                tone: metrics.total_outstanding > 0 ? ('accent' as const) : ('default' as const),
              },
              {
                label: 'Trading partners',
                value: `${formatNumber(metrics.supplier_count)} / ${formatNumber(metrics.vendor_count)}`,
                hint: 'Suppliers / registered vendors',
                icon: Store,
                tone: 'default' as const,
              },
              {
                label: 'Expired batches',
                value: formatNumber(metrics.expired_batch_count),
                hint: 'Past expiry — blocked from sale',
                icon: AlertTriangle,
                tone: metrics.expired_batch_count > 0 ? ('alert' as const) : ('default' as const),
              },
              {
                label: 'Expiring soon',
                value: formatNumber(metrics.expiring_soon_count),
                hint: 'Batches expiring within 7 days',
                icon: Clock,
                tone: metrics.expiring_soon_count > 0 ? ('accent' as const) : ('default' as const),
              },
            ].map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
                icon={card.icon}
                tone={card.tone}
              />
            ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="paper-panel min-w-0 md:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold text-foreground">
                Recent sales
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Latest vendor orders</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/sales">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : recentSales.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No sales recorded yet"
              description="Record a sale to a registered vendor and it will appear here."
            />
          ) : (
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="[&>div]:max-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Sale</TableHead>
                    <TableHead className="whitespace-nowrap">Vendor</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Method</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="paper-panel min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold text-foreground">
                Low stock
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Reorder soon</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/stock">
                Stock
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : lowStock.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Stock levels are healthy"
              description="No fruit and packaging combination is below its threshold."
            />
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.map((row) => (
                <li
                  key={row.stock_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.fruit_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {packagingLabel(row.packaging_size)} packaging · threshold{' '}
                      {formatNumber(row.low_stock_threshold)}
                    </p>
                  </div>
                  <span className="ledger-num shrink-0 border border-destructive/50 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {formatNumber(row.available_quantity)} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="paper-panel mt-6 min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold text-foreground">
              Best-selling fruits
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Ranked by boxes sold</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link to="/reports">
              Reports
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : topFruits.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title="No sales data yet"
            description="Once sales are recorded, the best-selling fruits will be ranked here."
          />
        ) : (
          <ul className="space-y-3 p-4">
            {topFruits.map((row, index) => (
              <li key={row.fruit_id} className="flex items-center gap-3">
                <span className="ledger-num w-5 shrink-0 text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{row.fruit_name}</p>
                    <p className="ledger-num shrink-0 text-xs text-muted-foreground">
                      {formatNumber(row.total_boxes)} boxes · {formatCurrency(row.total_revenue)}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.max(6, (row.total_boxes / maxBoxes) * 100)}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
