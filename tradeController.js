import * as tradeModel from '../models/tradeModel.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  requireDate,
  requireEnum,
  requireFields,
  requireId,
  requirePositiveNumber,
  validateLineItems,
} from '../middleware/validate.js';

/* ---------------- Purchases ---------------- */

export const listPurchases = asyncHandler(async (req, res) => {
  const purchases = await tradeModel.findPurchases();
  res.status(200).json({ success: true, count: purchases.length, data: purchases });
});

export const getPurchase = asyncHandler(async (req, res) => {
  const purchaseId = requireId(req.params.id, 'purchase id');
  const purchase = await tradeModel.findPurchaseById(purchaseId);
  if (!purchase) throw new ApiError(404, 'Purchase not found.');
  const details = await tradeModel.findPurchaseDetails(purchaseId);
  res.status(200).json({ success: true, data: { ...purchase, details } });
});

export const createPurchase = asyncHandler(async (req, res) => {
  requireFields(req.body, ['supplier_id', 'purchase_date']);
  const supplierId = requireId(req.body.supplier_id, 'supplier id');
  const purchaseDate = requireDate(req.body.purchase_date, 'Purchase date');
  const items = validateLineItems(req.body.items);

  const result = await tradeModel.createPurchase({
    supplier_id: supplierId,
    purchase_date: purchaseDate,
    items,
  });

  res.status(201).json({
    success: true,
    message: 'Purchase recorded and stock increased.',
    data: result,
  });
});

/* ---------------- Sales ---------------- */

export const listSales = asyncHandler(async (req, res) => {
  const sales = await tradeModel.findSales();
  res.status(200).json({ success: true, count: sales.length, data: sales });
});

export const listOutstandingSales = asyncHandler(async (req, res) => {
  const sales = await tradeModel.findOutstandingSales();
  res.status(200).json({ success: true, count: sales.length, data: sales });
});

export const getSale = asyncHandler(async (req, res) => {
  const saleId = requireId(req.params.id, 'sale id');
  const sale = await tradeModel.findSaleById(saleId);
  if (!sale) throw new ApiError(404, 'Sale not found.');
  const details = await tradeModel.findSaleDetails(saleId);
  const payments = await tradeModel.findPaymentsBySale(saleId);
  res.status(200).json({ success: true, data: { ...sale, details, payments } });
});

export const createSale = asyncHandler(async (req, res) => {
  requireFields(req.body, ['vendor_id', 'sale_date', 'payment_method']);
  const vendorId = requireId(req.body.vendor_id, 'vendor id');
  const saleDate = requireDate(req.body.sale_date, 'Sale date');
  const paymentMethod = requireEnum(
    req.body.payment_method,
    ['CASH', 'MOBILE_MONEY', 'CREDIT'],
    'Payment method',
  );
  const items = validateLineItems(req.body.items);

  const result = await tradeModel.createSale({
    vendor_id: vendorId,
    sale_date: saleDate,
    payment_method: paymentMethod,
    items,
  });

  res.status(201).json({
    success: true,
    message: 'Sale recorded and stock reduced.',
    data: result,
  });
});

/* ---------------- Payments ---------------- */

export const listPayments = asyncHandler(async (req, res) => {
  const payments = await tradeModel.findPayments();
  res.status(200).json({ success: true, count: payments.length, data: payments });
});

export const createPayment = asyncHandler(async (req, res) => {
  requireFields(req.body, ['sale_id', 'amount', 'payment_method', 'payment_date']);
  const saleId = requireId(req.body.sale_id, 'sale id');
  const amount = requirePositiveNumber(req.body.amount, 'Payment amount');
  const paymentMethod = requireEnum(
    req.body.payment_method,
    ['CASH', 'MOBILE_MONEY'],
    'Payment method',
  );
  const paymentDate = requireDate(req.body.payment_date, 'Payment date');

  const result = await tradeModel.createPayment({
    sale_id: saleId,
    amount,
    payment_method: paymentMethod,
    payment_date: paymentDate,
    note: req.body.note ?? null,
  });

  res.status(201).json({ success: true, message: 'Payment recorded.', data: result });
});

/* ---------------- Reports ---------------- */

export const reportTopFruits = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  const data = await tradeModel.reportTopFruits(Number.isInteger(limit) && limit > 0 ? limit : 5);
  res.status(200).json({ success: true, data });
});

export const reportRevenue = asyncHandler(async (req, res) => {
  const startDate = requireDate(req.query.start_date, 'Start date');
  const endDate = requireDate(req.query.end_date, 'End date');
  if (startDate > endDate) {
    throw new ApiError(400, 'Start date must be on or before the end date.');
  }
  const data = await tradeModel.reportRevenue(startDate, endDate);
  const totals = data.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue),
      boxes_sold: acc.boxes_sold + Number(row.boxes_sold),
      order_count: acc.order_count + Number(row.order_count),
    }),
    { revenue: 0, boxes_sold: 0, order_count: 0 },
  );
  res.status(200).json({ success: true, range: { startDate, endDate }, totals, data });
});

export const reportTopVendors = asyncHandler(async (req, res) => {
  const data = await tradeModel.reportTopVendors();
  res.status(200).json({ success: true, data });
});

export const reportStockLevels = asyncHandler(async (req, res) => {
  const data = await tradeModel.reportStockLevels();
  res.status(200).json({ success: true, data });
});

export const reportVendorBalances = asyncHandler(async (req, res) => {
  const data = await tradeModel.reportVendorBalances();
  res.status(200).json({ success: true, data });
});

export const dashboard = asyncHandler(async (req, res) => {
  const data = await tradeModel.dashboardMetrics();
  res.status(200).json({ success: true, data });
});
