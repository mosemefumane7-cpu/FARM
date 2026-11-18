export type PackagingSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CREDIT';
export type SettlementMethod = 'CASH' | 'MOBILE_MONEY';
export type FruitStatus = 'ACTIVE' | 'INACTIVE';

export const PROVINCES = [
  'Gauteng',
  'Free State',
  'KwaZulu-Natal',
  'Western Cape',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'North West',
] as const;

export type Province = (typeof PROVINCES)[number];

export const PACKAGING_SIZES: PackagingSize[] = ['SMALL', 'MEDIUM', 'LARGE'];

export interface Supplier {
  supplier_id: number;
  business_name: string;
  contact_person: string;
  phone: string;
  province: Province;
  address: string;
  created_at: string;
}

export interface Fruit {
  fruit_id: number;
  fruit_name: string;
  description: string | null;
  status: FruitStatus;
  created_at: string;
}

export interface Vendor {
  vendor_id: number;
  vendor_name: string;
  phone: string;
  location: string;
  registration_date: string;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
}

export interface Purchase {
  purchase_id: number;
  supplier_id: number;
  purchase_date: string;
  total_amount: number;
  created_at: string;
  supplier_name?: string;
}

export interface PurchaseDetail {
  purchase_detail_id: number;
  purchase_id: number;
  fruit_id: number;
  quantity: number;
  unit_cost: number;
  packaging_size: PackagingSize;
  fruit_name?: string;
}

export interface Sale {
  sale_id: number;
  vendor_id: number;
  sale_date: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  vendor_name?: string;
  vendor_phone?: string;
}

export interface SaleDetail {
  sale_detail_id: number;
  sale_id: number;
  fruit_id: number;
  packaging_size: PackagingSize;
  quantity: number;
  unit_price: number;
  fruit_name?: string;
}

export interface StockRow {
  stock_id: number;
  fruit_id: number;
  fruit_name: string;
  packaging_size: PackagingSize;
  available_quantity: number;
  saleable_quantity: number;
  expired_quantity: number;
  batch_count: number;
  expired_batch_count: number;
  earliest_expiry: string | null;
  low_stock_threshold: number;
  is_low: boolean;
}

export type ExpiryStatus = 'FRESH' | 'EXPIRING_SOON' | 'EXPIRED';

export interface StockBatch {
  batch_id: number;
  batch_number: string;
  fruit_id: number;
  fruit_name: string;
  packaging_size: PackagingSize;
  quantity_received: number;
  quantity_remaining: number;
  expiry_date: string;
  received_date: string;
  purchase_id: number | null;
  days_until_expiry: number;
  expiry_status: ExpiryStatus;
}

export interface ExpiringBatchRow {
  batch_id: number;
  batch_number: string;
  fruit_name: string;
  packaging_size: PackagingSize;
  quantity_remaining: number;
  expiry_date: string;
  days_until_expiry: number;
  expiry_status: ExpiryStatus;
}

export interface FruitPrice {
  price_id: number;
  fruit_id: number;
  packaging_size: PackagingSize;
  selling_price: number;
}

export interface Payment {
  payment_id: number;
  sale_id: number;
  vendor_id: number;
  amount: number;
  payment_method: SettlementMethod;
  payment_date: string;
  note: string | null;
  created_at: string;
  vendor_name?: string;
}

export interface VendorBalance {
  vendor_id: number;
  vendor_name: string;
  phone: string;
  location: string;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
  sale_count: number;
}

export interface DashboardMetrics {
  total_revenue: number;
  total_purchases: number;
  total_stock_boxes: number;
  low_stock_count: number;
  total_outstanding: number;
  supplier_count: number;
  vendor_count: number;
  active_fruit_count: number;
  sale_count: number;
  purchase_count: number;
  expired_batch_count: number;
  expiring_soon_count: number;
}

export interface TopFruitRow {
  fruit_id: number;
  fruit_name: string;
  total_boxes: number;
  total_revenue: number;
  order_count: number;
}

export interface RevenueRow {
  report_date: string;
  order_count: number;
  boxes_sold: number;
  revenue: number;
}

export interface TopVendorRow {
  vendor_id: number;
  vendor_name: string;
  phone: string;
  location: string;
  total_boxes: number;
  order_count: number;
  total_value: number;
}

export interface LineItemInput {
  fruit_id: number;
  packaging_size: PackagingSize;
  quantity: number;
  unit_price: number;
}

export interface PurchaseLineInput {
  fruit_id: number;
  packaging_size: PackagingSize;
  quantity: number;
  unit_cost: number;
  batch_number: string;
  expiry_date: string;
}
