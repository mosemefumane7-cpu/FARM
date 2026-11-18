import pool from '../config/db.js';

const SELECT_BASE = `
  SELECT vendor_id, vendor_name, phone, location, registration_date
  FROM vendors
`;

export const findAll = async (search) => {
  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    const [rows] = await pool.query(
      `${SELECT_BASE} WHERE vendor_name LIKE ? OR phone LIKE ? ORDER BY vendor_name ASC`,
      [term, term],
    );
    return rows;
  }
  const [rows] = await pool.query(`${SELECT_BASE} ORDER BY vendor_name ASC`);
  return rows;
};

export const findById = async (vendorId) => {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE vendor_id = ?`, [vendorId]);
  return rows[0] ?? null;
};

export const create = async ({ vendor_name, phone, location, registration_date }) => {
  const [result] = await pool.query(
    `INSERT INTO vendors (vendor_name, phone, location, registration_date)
     VALUES (?, ?, ?, ?)`,
    [vendor_name, phone, location, registration_date],
  );
  return findById(result.insertId);
};

export const update = async (vendorId, { vendor_name, phone, location, registration_date }) => {
  await pool.query(
    `UPDATE vendors
        SET vendor_name = ?, phone = ?, location = ?, registration_date = ?
      WHERE vendor_id = ?`,
    [vendor_name, phone, location, registration_date, vendorId],
  );
  return findById(vendorId);
};

export const remove = async (vendorId) => {
  const [result] = await pool.query('DELETE FROM vendors WHERE vendor_id = ?', [vendorId]);
  return result.affectedRows > 0;
};

/** Referential guard: a vendor with sales history cannot be deleted. */
export const countSales = async (vendorId) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM sales WHERE vendor_id = ?', [
    vendorId,
  ]);
  return Number(rows[0].total);
};
