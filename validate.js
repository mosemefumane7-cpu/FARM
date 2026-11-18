import { ApiError } from './errorHandler.js';

export const PACKAGING_SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
export const PROVINCES = [
  'Gauteng',
  'Free State',
  'KwaZulu-Natal',
  'Western Cape',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'North West',
];

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

export const requireFields = (body, fields) => {
  const missing = fields.filter((field) => isBlank(body[field]));
  if (missing.length > 0) {
    throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}.`);
  }
};

export const requirePositiveInt = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${label} must be a positive whole number.`);
  }
  return parsed;
};

export const requirePositiveNumber = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${label} must be a number greater than zero.`);
  }
  return parsed;
};

export const requireEnum = (value, allowed, label) => {
  if (!allowed.includes(value)) {
    throw new ApiError(400, `${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
};

export const requireDate = (value, label) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new ApiError(400, `${label} must be a valid date in YYYY-MM-DD format.`);
  }
  return value;
};

export const requireId = (value, label = 'id') => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
  return parsed;
};

/**
 * Validates a multi-item order payload (purchase or sale).
 * Returns normalised line items or throws a 400 with the offending line.
 */
export const validateLineItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Please add at least one fruit line item.');
  }

  return items.map((item, index) => {
    const line = index + 1;
    if (isBlank(item.fruit_id)) {
      throw new ApiError(400, `Line ${line}: a fruit must be selected.`);
    }
    return {
      fruit_id: requirePositiveInt(item.fruit_id, `Line ${line}: fruit`),
      packaging_size: requireEnum(
        item.packaging_size,
        PACKAGING_SIZES,
        `Line ${line}: packaging size`,
      ),
      quantity: requirePositiveInt(item.quantity, `Line ${line}: quantity`),
      price: requirePositiveNumber(
        item.unit_price ?? item.unit_cost,
        `Line ${line}: ${item.unit_price !== undefined ? 'unit price' : 'unit cost'}`,
      ),
    };
  });
};
