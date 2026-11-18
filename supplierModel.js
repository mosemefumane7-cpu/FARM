import pool from '../config/db.js';

const SELECT_BASE = `
  SELECT supplier_id, business_name, contact_person, phone, province, address, created_at
  FROM suppliers
`;

export const findAll = async () => {
  const [rows] = await pool.query(`${SELECT_BASE} ORDER BY business_name ASC`);
  return rows;
};

export const findById = async (supplierId) => {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE supplier_id = ?`, [supplierId]);
  return rows[0] ?? null;
};

export const create = async ({ business_name, contact_person, phone, province, address }) => {
  const [result] = await pool.query(
    `INSERT INTO suppliers (business_name, contact_person, phone, province, address)
     VALUES (?, ?, ?, ?, ?)`,
    [business_name, contact_person, phone, province, address],
  );
  return findById(result.insertId);
};

export const update = async (supplierId, { business_name, contact_person, phone, province, address }) => {
  await pool.query(
    `UPDATE suppliers
        SET business_name = ?, contact_person = ?, phone = ?, province = ?, address = ?
      WHERE supplier_id = ?`,
    [business_name, contact_person, phone, province, address, supplierId],
  );
  return findById(supplierId);
};

export const remove = async (supplierId) => {
  const [result] = await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [supplierId]);
  return result.affectedRows > 0;
};

/** Referential guard: a supplier with purchase history cannot be deleted. */
export const countPurchases = async (supplierId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM purchases WHERE supplier_id = ?',
    [supplierId],
  );
  return Number(rows[0].total);
};
