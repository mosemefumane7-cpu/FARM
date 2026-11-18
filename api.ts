import { supabase } from '@/db/supabase';
import type {
  DashboardMetrics,
  ExpiringBatchRow,
  ExpiryStatus,
  Fruit,
  FruitPrice,
  LineItemInput,
  PackagingSize,
  Payment,
  Purchase,
  PurchaseDetail,
  PurchaseLineInput,
  RevenueRow,
  Sale,
  SaleDetail,
  StockBatch,
  StockRow,
  Supplier,
  TopFruitRow,
  TopVendorRow,
  Vendor,
  VendorBalance,
} from '@/types/types';

const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));

const raise = (error: { message: string } | null, fallback: string): never => {
  throw new Error(error?.message?.trim() ? error.message : fallback);
};

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('supplier_id, business_name, contact_person, phone, province, address, created_at')
    .order('business_name', { ascending: true })
    .limit(500);
  if (error) raise(error, 'Unable to load suppliers.');
  return Array.isArray(data) ? (data as Supplier[]) : [];
}

export async function getSupplier(supplierId: number): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('supplier_id, business_name, contact_person, phone, province, address, created_at')
    .eq('supplier_id', supplierId)
    .maybeSingle();
  if (error) raise(error, 'Unable to load the supplier.');
  return (data as Supplier) ?? null;
}

export async function createSupplier(
  payload: Omit<Supplier, 'supplier_id' | 'created_at'>,
): Promise<number> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(payload)
    .select('supplier_id')
    .maybeSingle();
  if (error) raise(error, 'Unable to register the supplier.');
  return num((data as { supplier_id?: number } | null)?.supplier_id);
}

export async function updateSupplier(
  supplierId: number,
  payload: Omit<Supplier, 'supplier_id' | 'created_at'>,
): Promise<void> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('supplier_id', supplierId)
    .select('supplier_id');
  if (error) raise(error, 'Unable to update the supplier.');
  if (!data || data.length === 0) throw new Error('Supplier not found.');
}

export async function deleteSupplier(supplierId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_supplier_checked', { p_supplier_id: supplierId });
  if (error) raise(error, 'Unable to delete the supplier.');
}

/* ------------------------------------------------------------------ */
/* Fruits                                                              */
/* ------------------------------------------------------------------ */

export async function listFruits(): Promise<Fruit[]> {
  const { data, error } = await supabase
    .from('fruits')
    .select('fruit_id, fruit_name, description, status, created_at')
    .order('fruit_name', { ascending: true })
    .limit(500);
  if (error) raise(error, 'Unable to load fruits.');
  return Array.isArray(data) ? (data as Fruit[]) : [];
}

export async function createFruit(payload: {
  fruit_name: string;
  description: string | null;
  status: Fruit['status'];
}): Promise<number> {
  const { data, error } = await supabase
    .from('fruits')
    .insert(payload)
    .select('fruit_id')
    .maybeSingle();
  if (error) raise(error, 'Unable to register the fruit.');
  const fruitId = num((data as { fruit_id?: number } | null)?.fruit_id);

  // Every fruit must own one stock record per packaging size.
  const stockRows = (['SMALL', 'MEDIUM', 'LARGE'] as const).map((size) => ({
    fruit_id: fruitId,
    packaging_size: size,
    available_quantity: 0,
    low_stock_threshold: 20,
  }));
  const { error: stockError } = await supabase.from('stock').insert(stockRows);
  if (stockError) raise(stockError, 'Fruit created but its stock records could not be initialised.');

  return fruitId;
}

export async function updateFruit(
  fruitId: number,
  payload: { fruit_name: string; description: string | null; status: Fruit['status'] },
): Promise<void> {
  const { data, error } = await supabase
    .from('fruits')
    .update(payload)
    .eq('fruit_id', fruitId)
    .select('fruit_id');
  if (error) raise(error, 'Unable to update the fruit.');
  if (!data || data.length === 0) throw new Error('Fruit not found.');
}

export async function deleteFruit(fruitId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_fruit_checked', { p_fruit_id: fruitId });
  if (error) raise(error, 'Unable to delete the fruit.');
}

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

export async function listStockLevels(): Promise<StockRow[]> {
  const { data, error } = await supabase.rpc('report_stock_levels');
  if (error) raise(error, 'Unable to load stock levels.');
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    stock_id: num(row.stock_id),
    fruit_id: num(row.fruit_id),
    fruit_name: String(row.fruit_name ?? ''),
    packaging_size: row.packaging_size,
    available_quantity: num(row.available_quantity),
    saleable_quantity: num(row.saleable_quantity),
    expired_quantity: num(row.expired_quantity),
    batch_count: num(row.batch_count),
    expired_batch_count: num(row.expired_batch_count),
    earliest_expiry: row.earliest_expiry ? String(row.earliest_expiry) : null,
    low_stock_threshold: num(row.low_stock_threshold),
    is_low: Boolean(row.is_low),
  })) as StockRow[];
}

export async function listBatches(status: ExpiryStatus | 'ALL' = 'ALL'): Promise<StockBatch[]> {
  const { data, error } = await supabase.rpc('list_batches', {
    p_status: status === 'ALL' ? null : status,
  });
  if (error) raise(error, 'Unable to load stock batches.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    batch_id: num(row.batch_id),
    batch_number: String(row.batch_number ?? ''),
    fruit_id: num(row.fruit_id),
    fruit_name: String(row.fruit_name ?? ''),
    packaging_size: row.packaging_size as PackagingSize,
    quantity_received: num(row.quantity_received),
    quantity_remaining: num(row.quantity_remaining),
    expiry_date: String(row.expiry_date ?? ''),
    received_date: String(row.received_date ?? ''),
    purchase_id:
      row.purchase_id === null || row.purchase_id === undefined ? null : num(row.purchase_id),
    days_until_expiry: num(row.days_until_expiry),
    expiry_status: (row.expiry_status ?? 'FRESH') as ExpiryStatus,
  }));
}

export async function suggestBatchNumbers(date: string, count: number): Promise<string[]> {
  const { data, error } = await supabase.rpc('suggest_batch_numbers', {
    p_date: date,
    p_count: count,
  });
  if (error) raise(error, 'Unable to generate batch numbers.');
  return Array.isArray(data) ? (data as string[]) : [];
}

export async function listExpiringBatches(days = 30): Promise<ExpiringBatchRow[]> {
  const { data, error } = await supabase.rpc('report_expiring_batches', { p_days: days });
  if (error) raise(error, 'Unable to load expiring batches.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    batch_id: num(row.batch_id),
    batch_number: String(row.batch_number ?? ''),
    fruit_name: String(row.fruit_name ?? ''),
    packaging_size: row.packaging_size as PackagingSize,
    quantity_remaining: num(row.quantity_remaining),
    expiry_date: String(row.expiry_date ?? ''),
    days_until_expiry: num(row.days_until_expiry),
    expiry_status: (row.expiry_status ?? 'FRESH') as ExpiryStatus,
  }));
}

export async function updateStockThreshold(stockId: number, threshold: number): Promise<void> {
  const { data, error } = await supabase
    .from('stock')
    .update({ low_stock_threshold: threshold, updated_at: new Date().toISOString() })
    .eq('stock_id', stockId)
    .select('stock_id');
  if (error) raise(error, 'Unable to update the low-stock threshold.');
  if (!data || data.length === 0) throw new Error('Stock record not found.');
}

export async function listFruitPrices(): Promise<FruitPrice[]> {
  const { data, error } = await supabase
    .from('fruit_prices')
    .select('price_id, fruit_id, packaging_size, selling_price')
    .order('fruit_id', { ascending: true })
    .limit(500);
  if (error) raise(error, 'Unable to load selling prices.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    price_id: num(row.price_id),
    fruit_id: num(row.fruit_id),
    packaging_size: row.packaging_size,
    selling_price: num(row.selling_price),
  })) as FruitPrice[];
}

export async function upsertFruitPrice(
  fruitId: number,
  packagingSize: FruitPrice['packaging_size'],
  sellingPrice: number,
): Promise<void> {
  const { error } = await supabase.from('fruit_prices').upsert(
    {
      fruit_id: fruitId,
      packaging_size: packagingSize,
      selling_price: sellingPrice,
    },
    { onConflict: 'fruit_id,packaging_size' },
  );
  if (error) raise(error, 'Unable to save the selling price.');
}

/* ------------------------------------------------------------------ */
/* Vendors                                                             */
/* ------------------------------------------------------------------ */

export async function listVendors(search?: string): Promise<Vendor[]> {
  let query = supabase
    .from('vendors')
    .select('vendor_id, vendor_name, phone, location, registration_date, latitude, longitude, location_updated_at')
    .order('vendor_name', { ascending: true })
    .limit(500);

  const term = search?.trim();
  if (term) {
    const safe = term.replace(/[%,()]/g, '');
    query = query.or(`vendor_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) raise(error, 'Unable to load vendors.');
  return Array.isArray(data) ? (data as Vendor[]) : [];
}

export async function createVendor(payload: {
  vendor_name: string;
  phone: string;
  location: string;
  registration_date: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<number> {
  const { data, error } = await supabase
    .from('vendors')
    .insert(payload)
    .select('vendor_id')
    .maybeSingle();
  if (error) raise(error, 'Unable to register the vendor.');
  return num((data as { vendor_id?: number } | null)?.vendor_id);
}

export async function updateVendor(
  vendorId: number,
  payload: {
    vendor_name: string;
    phone: string;
    location: string;
    registration_date: string;
    latitude: number | null;
    longitude: number | null;
  },
): Promise<void> {
  const { data, error } = await supabase
    .from('vendors')
    .update({ ...payload, location_updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .select('vendor_id');
  if (error) raise(error, 'Unable to update the vendor.');
  if (!data || data.length === 0) throw new Error('Vendor not found.');
}

export async function updateVendorLocation(
  vendorId: number,
  latitude: number,
  longitude: number,
): Promise<void> {
  const { data, error } = await supabase
    .from('vendors')
    .update({ latitude, longitude, location_updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .select('vendor_id');
  if (error) raise(error, 'Unable to save the vendor location.');
  if (!data || data.length === 0) throw new Error('Vendor not found.');
}

export async function deleteVendor(vendorId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_vendor_checked', { p_vendor_id: vendorId });
  if (error) raise(error, 'Unable to delete the vendor.');
}

/* ------------------------------------------------------------------ */
/* Purchases                                                           */
/* ------------------------------------------------------------------ */

export async function listPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      'purchase_id, supplier_id, purchase_date, total_amount, created_at, suppliers!purchases_supplier_id_fkey(business_name)',
    )
    .order('purchase_date', { ascending: false })
    .order('purchase_id', { ascending: false })
    .limit(300);
  if (error) raise(error, 'Unable to load purchases.');
  return (Array.isArray(data) ? data : []).map((row) => {
    const supplier = row.suppliers as { business_name?: string } | null;
    return {
      purchase_id: num(row.purchase_id),
      supplier_id: num(row.supplier_id),
      purchase_date: String(row.purchase_date ?? ''),
      total_amount: num(row.total_amount),
      created_at: String(row.created_at ?? ''),
      supplier_name: supplier?.business_name ?? 'Unknown supplier',
    };
  });
}

export async function listPurchaseDetails(purchaseId: number): Promise<PurchaseDetail[]> {
  const { data, error } = await supabase
    .from('purchase_details')
    .select(
      'purchase_detail_id, purchase_id, fruit_id, quantity, unit_cost, packaging_size, fruits!purchase_details_fruit_id_fkey(fruit_name)',
    )
    .eq('purchase_id', purchaseId)
    .order('purchase_detail_id', { ascending: true })
    .limit(200);
  if (error) raise(error, 'Unable to load the purchase lines.');
  return (Array.isArray(data) ? data : []).map((row) => {
    const fruit = row.fruits as { fruit_name?: string } | null;
    return {
      purchase_detail_id: num(row.purchase_detail_id),
      purchase_id: num(row.purchase_id),
      fruit_id: num(row.fruit_id),
      quantity: num(row.quantity),
      unit_cost: num(row.unit_cost),
      packaging_size: row.packaging_size,
      fruit_name: fruit?.fruit_name ?? 'Unknown fruit',
    };
  }) as PurchaseDetail[];
}

export async function createPurchase(input: {
  supplier_id: number;
  purchase_date: string;
  items: PurchaseLineInput[];
}): Promise<{ purchase_id: number; total_amount: number; line_count: number }> {
  const { data, error } = await supabase.rpc('record_purchase', {
    p_supplier_id: input.supplier_id,
    p_purchase_date: input.purchase_date,
    p_items: input.items,
  });
  if (error) raise(error, 'Unable to record the purchase.');
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    purchase_id: num(result.purchase_id),
    total_amount: num(result.total_amount),
    line_count: num(result.line_count),
  };
}

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

export async function listSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(
      'sale_id, vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid, created_at, vendors!sales_vendor_id_fkey(vendor_name, phone)',
    )
    .order('sale_date', { ascending: false })
    .order('sale_id', { ascending: false })
    .limit(300);
  if (error) raise(error, 'Unable to load sales.');
  return (Array.isArray(data) ? data : []).map((row) => {
    const vendor = row.vendors as { vendor_name?: string; phone?: string } | null;
    return {
      sale_id: num(row.sale_id),
      vendor_id: num(row.vendor_id),
      sale_date: String(row.sale_date ?? ''),
      payment_status: row.payment_status,
      payment_method: row.payment_method,
      total_amount: num(row.total_amount),
      amount_paid: num(row.amount_paid),
      created_at: String(row.created_at ?? ''),
      vendor_name: vendor?.vendor_name ?? 'Unknown vendor',
      vendor_phone: vendor?.phone ?? '',
    };
  }) as Sale[];
}

export async function listSaleDetails(saleId: number): Promise<SaleDetail[]> {
  const { data, error } = await supabase
    .from('sale_details')
    .select(
      'sale_detail_id, sale_id, fruit_id, packaging_size, quantity, unit_price, fruits!sale_details_fruit_id_fkey(fruit_name)',
    )
    .eq('sale_id', saleId)
    .order('sale_detail_id', { ascending: true })
    .limit(200);
  if (error) raise(error, 'Unable to load the sale lines.');
  return (Array.isArray(data) ? data : []).map((row) => {
    const fruit = row.fruits as { fruit_name?: string } | null;
    return {
      sale_detail_id: num(row.sale_detail_id),
      sale_id: num(row.sale_id),
      fruit_id: num(row.fruit_id),
      packaging_size: row.packaging_size,
      quantity: num(row.quantity),
      unit_price: num(row.unit_price),
      fruit_name: fruit?.fruit_name ?? 'Unknown fruit',
    };
  }) as SaleDetail[];
}

export async function createSale(input: {
  vendor_id: number;
  sale_date: string;
  payment_method: Sale['payment_method'];
  items: LineItemInput[];
}): Promise<{
  sale_id: number;
  total_amount: number;
  payment_status: Sale['payment_status'];
  line_count: number;
}> {
  const { data, error } = await supabase.rpc('record_sale', {
    p_vendor_id: input.vendor_id,
    p_sale_date: input.sale_date,
    p_items: input.items,
    p_payment_method: input.payment_method,
  });
  if (error) raise(error, 'Unable to record the sale.');
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    sale_id: num(result.sale_id),
    total_amount: num(result.total_amount),
    payment_status: result.payment_status as Sale['payment_status'],
    line_count: num(result.line_count),
  };
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function listPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      'payment_id, sale_id, vendor_id, amount, payment_method, payment_date, note, created_at, vendors!payments_vendor_id_fkey(vendor_name)',
    )
    .order('payment_date', { ascending: false })
    .order('payment_id', { ascending: false })
    .limit(300);
  if (error) raise(error, 'Unable to load payments.');
  return (Array.isArray(data) ? data : []).map((row) => {
    const vendor = row.vendors as { vendor_name?: string } | null;
    return {
      payment_id: num(row.payment_id),
      sale_id: num(row.sale_id),
      vendor_id: num(row.vendor_id),
      amount: num(row.amount),
      payment_method: row.payment_method,
      payment_date: String(row.payment_date ?? ''),
      note: (row.note as string | null) ?? null,
      created_at: String(row.created_at ?? ''),
      vendor_name: vendor?.vendor_name ?? 'Unknown vendor',
    };
  }) as Payment[];
}

export async function listOutstandingSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(
      'sale_id, vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid, created_at, vendors!sales_vendor_id_fkey(vendor_name, phone)',
    )
    .neq('payment_status', 'PAID')
    .order('sale_date', { ascending: true })
    .limit(300);
  if (error) raise(error, 'Unable to load outstanding sales.');
  return (Array.isArray(data) ? data : []).map((row) => {
    const vendor = row.vendors as { vendor_name?: string; phone?: string } | null;
    return {
      sale_id: num(row.sale_id),
      vendor_id: num(row.vendor_id),
      sale_date: String(row.sale_date ?? ''),
      payment_status: row.payment_status,
      payment_method: row.payment_method,
      total_amount: num(row.total_amount),
      amount_paid: num(row.amount_paid),
      created_at: String(row.created_at ?? ''),
      vendor_name: vendor?.vendor_name ?? 'Unknown vendor',
      vendor_phone: vendor?.phone ?? '',
    };
  }) as Sale[];
}

export async function recordPayment(input: {
  sale_id: number;
  amount: number;
  payment_method: 'CASH' | 'MOBILE_MONEY';
  payment_date: string;
}): Promise<{ amount_paid: number; outstanding: number; payment_status: Sale['payment_status'] }> {
  const { data, error } = await supabase.rpc('record_payment', {
    p_sale_id: input.sale_id,
    p_amount: input.amount,
    p_method: input.payment_method,
    p_payment_date: input.payment_date,
  });
  if (error) raise(error, 'Unable to record the payment.');
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    amount_paid: num(result.amount_paid),
    outstanding: num(result.outstanding),
    payment_status: result.payment_status as Sale['payment_status'],
  };
}

export async function listVendorBalances(): Promise<VendorBalance[]> {
  const { data, error } = await supabase.rpc('vendor_balances');
  if (error) raise(error, 'Unable to load vendor balances.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    vendor_id: num(row.vendor_id),
    vendor_name: String(row.vendor_name ?? ''),
    phone: String(row.phone ?? ''),
    location: String(row.location ?? ''),
    total_billed: num(row.total_billed),
    total_paid: num(row.total_paid),
    outstanding_balance: num(row.outstanding_balance),
    sale_count: num(row.sale_count),
  }));
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc('dashboard_metrics');
  if (error) raise(error, 'Unable to load dashboard metrics.');
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    total_revenue: num(row.total_revenue),
    total_purchases: num(row.total_purchases),
    total_stock_boxes: num(row.total_stock_boxes),
    low_stock_count: num(row.low_stock_count),
    total_outstanding: num(row.total_outstanding),
    supplier_count: num(row.supplier_count),
    vendor_count: num(row.vendor_count),
    active_fruit_count: num(row.active_fruit_count),
    sale_count: num(row.sale_count),
    purchase_count: num(row.purchase_count),
    expired_batch_count: num(row.expired_batch_count),
    expiring_soon_count: num(row.expiring_soon_count),
  };
}

export async function getTopFruits(limit = 5): Promise<TopFruitRow[]> {
  const { data, error } = await supabase.rpc('report_top_fruits', { p_limit: limit });
  if (error) raise(error, 'Unable to load the top-selling fruits report.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    fruit_id: num(row.fruit_id),
    fruit_name: String(row.fruit_name ?? ''),
    total_boxes: num(row.total_boxes),
    total_revenue: num(row.total_revenue),
    order_count: num(row.order_count),
  }));
}

export async function getRevenueByRange(start: string, end: string): Promise<RevenueRow[]> {
  const { data, error } = await supabase.rpc('report_revenue', { p_start: start, p_end: end });
  if (error) raise(error, 'Unable to load the revenue report.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    report_date: String(row.report_date ?? ''),
    order_count: num(row.order_count),
    boxes_sold: num(row.boxes_sold),
    revenue: num(row.revenue),
  }));
}

export async function getTopVendors(): Promise<TopVendorRow[]> {
  const { data, error } = await supabase.rpc('report_top_vendors');
  if (error) raise(error, 'Unable to load the vendor volume report.');
  return (Array.isArray(data) ? data : []).map((row) => ({
    vendor_id: num(row.vendor_id),
    vendor_name: String(row.vendor_name ?? ''),
    phone: String(row.phone ?? ''),
    location: String(row.location ?? ''),
    total_boxes: num(row.total_boxes),
    order_count: num(row.order_count),
    total_value: num(row.total_value),
  }));
}
