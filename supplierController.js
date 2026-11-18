import * as supplierModel from '../models/supplierModel.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { PROVINCES, requireEnum, requireFields, requireId } from '../middleware/validate.js';

const normalise = (body) => ({
  business_name: String(body.business_name).trim(),
  contact_person: String(body.contact_person).trim(),
  phone: String(body.phone).trim(),
  province: requireEnum(body.province, PROVINCES, 'Province'),
  address: String(body.address).trim(),
});

/** GET /api/suppliers */
export const list = asyncHandler(async (req, res) => {
  const suppliers = await supplierModel.findAll();
  res.status(200).json({ success: true, count: suppliers.length, data: suppliers });
});

/** GET /api/suppliers/:id */
export const getOne = asyncHandler(async (req, res) => {
  const supplier = await supplierModel.findById(requireId(req.params.id, 'supplier id'));
  if (!supplier) throw new ApiError(404, 'Supplier not found.');
  res.status(200).json({ success: true, data: supplier });
});

/** POST /api/suppliers */
export const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['business_name', 'contact_person', 'phone', 'province', 'address']);
  const supplier = await supplierModel.create(normalise(req.body));
  res.status(201).json({ success: true, message: 'Supplier registered.', data: supplier });
});

/** PUT /api/suppliers/:id */
export const update = asyncHandler(async (req, res) => {
  const supplierId = requireId(req.params.id, 'supplier id');
  const existing = await supplierModel.findById(supplierId);
  if (!existing) throw new ApiError(404, 'Supplier not found.');

  requireFields(req.body, ['business_name', 'contact_person', 'phone', 'province', 'address']);
  const supplier = await supplierModel.update(supplierId, normalise(req.body));
  res.status(200).json({ success: true, message: 'Supplier updated.', data: supplier });
});

/** DELETE /api/suppliers/:id */
export const remove = asyncHandler(async (req, res) => {
  const supplierId = requireId(req.params.id, 'supplier id');
  const existing = await supplierModel.findById(supplierId);
  if (!existing) throw new ApiError(404, 'Supplier not found.');

  const purchaseCount = await supplierModel.countPurchases(supplierId);
  if (purchaseCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete supplier: ${purchaseCount} linked purchase record(s) exist.`,
    );
  }

  await supplierModel.remove(supplierId);
  res.status(200).json({ success: true, message: 'Supplier deleted.' });
});
