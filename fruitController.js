import * as fruitModel from '../models/fruitModel.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  PACKAGING_SIZES,
  requireEnum,
  requireFields,
  requireId,
  requirePositiveNumber,
} from '../middleware/validate.js';

/** GET /api/fruits */
export const list = asyncHandler(async (req, res) => {
  const fruits = await fruitModel.findAll();
  res.status(200).json({ success: true, count: fruits.length, data: fruits });
});

/** GET /api/fruits/:id */
export const getOne = asyncHandler(async (req, res) => {
  const fruit = await fruitModel.findById(requireId(req.params.id, 'fruit id'));
  if (!fruit) throw new ApiError(404, 'Fruit not found.');
  res.status(200).json({ success: true, data: fruit });
});

/** POST /api/fruits — also creates the three packaging stock rows. */
export const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['fruit_name']);
  const fruitId = await fruitModel.create({
    fruit_name: String(req.body.fruit_name).trim(),
    description: req.body.description ?? null,
    status: req.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    prices: req.body.prices ?? null,
  });
  const fruit = await fruitModel.findById(fruitId);
  res.status(201).json({
    success: true,
    message: 'Fruit registered with Small, Medium and Large stock records.',
    data: fruit,
  });
});

/** PUT /api/fruits/:id */
export const update = asyncHandler(async (req, res) => {
  const fruitId = requireId(req.params.id, 'fruit id');
  const existing = await fruitModel.findById(fruitId);
  if (!existing) throw new ApiError(404, 'Fruit not found.');

  requireFields(req.body, ['fruit_name']);
  const fruit = await fruitModel.update(fruitId, {
    fruit_name: String(req.body.fruit_name).trim(),
    description: req.body.description ?? null,
    status: req.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  });
  res.status(200).json({ success: true, message: 'Fruit updated.', data: fruit });
});

/** DELETE /api/fruits/:id */
export const remove = asyncHandler(async (req, res) => {
  const fruitId = requireId(req.params.id, 'fruit id');
  const existing = await fruitModel.findById(fruitId);
  if (!existing) throw new ApiError(404, 'Fruit not found.');

  const history = await fruitModel.countHistory(fruitId);
  if (history.purchases > 0 || history.sales > 0) {
    throw new ApiError(
      400,
      `Cannot delete fruit: ${history.purchases} purchase line(s) and ${history.sales} sale line(s) reference it.`,
    );
  }

  await fruitModel.remove(fruitId);
  res.status(200).json({ success: true, message: 'Fruit deleted.' });
});

/** GET /api/stock — every fruit x packaging size. */
export const listStock = asyncHandler(async (req, res) => {
  const stock = await fruitModel.findStock();
  res.status(200).json({ success: true, count: stock.length, data: stock });
});

/** GET /api/stock/low — fruits at or below their threshold. */
export const listLowStock = asyncHandler(async (req, res) => {
  const stock = await fruitModel.findLowStock();
  res.status(200).json({ success: true, count: stock.length, data: stock });
});

/** PATCH /api/stock/:id — update the low-stock threshold. */
export const updateThreshold = asyncHandler(async (req, res) => {
  const stockId = requireId(req.params.id, 'stock id');
  const threshold = Number(req.body.low_stock_threshold);
  if (!Number.isInteger(threshold) || threshold < 0) {
    throw new ApiError(400, 'Low stock threshold must be a whole number of zero or more.');
  }
  const stock = await fruitModel.updateThreshold(stockId, threshold);
  if (!stock) throw new ApiError(404, 'Stock record not found.');
  res.status(200).json({ success: true, message: 'Threshold updated.', data: stock });
});

/** GET /api/fruits/prices */
export const listPrices = asyncHandler(async (req, res) => {
  const prices = await fruitModel.findPrices();
  res.status(200).json({ success: true, count: prices.length, data: prices });
});

/** PUT /api/fruits/:id/prices — set the selling price for one packaging size. */
export const updatePrice = asyncHandler(async (req, res) => {
  const fruitId = requireId(req.params.id, 'fruit id');
  const existing = await fruitModel.findById(fruitId);
  if (!existing) throw new ApiError(404, 'Fruit not found.');

  const packagingSize = requireEnum(req.body.packaging_size, PACKAGING_SIZES, 'Packaging size');
  const sellingPrice = requirePositiveNumber(req.body.selling_price, 'Selling price');

  await fruitModel.upsertPrice(fruitId, packagingSize, sellingPrice);
  res.status(200).json({ success: true, message: 'Selling price saved.' });
});
