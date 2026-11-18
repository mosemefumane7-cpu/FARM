import * as vendorModel from '../models/vendorModel.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { requireDate, requireFields, requireId } from '../middleware/validate.js';

const normalise = (body) => ({
  vendor_name: String(body.vendor_name).trim(),
  phone: String(body.phone).trim(),
  location: String(body.location).trim(),
  registration_date: requireDate(body.registration_date, 'Registration date'),
});

/** GET /api/vendors?search=term — search by name or phone. */
export const list = asyncHandler(async (req, res) => {
  const vendors = await vendorModel.findAll(req.query.search);
  res.status(200).json({ success: true, count: vendors.length, data: vendors });
});

/** GET /api/vendors/:id */
export const getOne = asyncHandler(async (req, res) => {
  const vendor = await vendorModel.findById(requireId(req.params.id, 'vendor id'));
  if (!vendor) throw new ApiError(404, 'Vendor not found.');
  res.status(200).json({ success: true, data: vendor });
});

/** POST /api/vendors */
export const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['vendor_name', 'phone', 'location', 'registration_date']);
  const vendor = await vendorModel.create(normalise(req.body));
  res.status(201).json({ success: true, message: 'Vendor registered.', data: vendor });
});

/** PUT /api/vendors/:id */
export const update = asyncHandler(async (req, res) => {
  const vendorId = requireId(req.params.id, 'vendor id');
  const existing = await vendorModel.findById(vendorId);
  if (!existing) throw new ApiError(404, 'Vendor not found.');

  requireFields(req.body, ['vendor_name', 'phone', 'location', 'registration_date']);
  const vendor = await vendorModel.update(vendorId, normalise(req.body));
  res.status(200).json({ success: true, message: 'Vendor updated.', data: vendor });
});

/** DELETE /api/vendors/:id */
export const remove = asyncHandler(async (req, res) => {
  const vendorId = requireId(req.params.id, 'vendor id');
  const existing = await vendorModel.findById(vendorId);
  if (!existing) throw new ApiError(404, 'Vendor not found.');

  const saleCount = await vendorModel.countSales(vendorId);
  if (saleCount > 0) {
    throw new ApiError(400, `Cannot delete vendor: ${saleCount} linked sale record(s) exist.`);
  }

  await vendorModel.remove(vendorId);
  res.status(200).json({ success: true, message: 'Vendor deleted.' });
});
