import pool, { withTransaction } from '../config/db.js';
import { PACKAGING_SIZES } from '../middleware/validate.js';

export const findAll = async () => {
  const [rows] = await pool.query(
    `SELECT fruit_id, fruit_name, description, status, created_at
       FROM fruits
      ORDER BY fruit_name ASC`,
  );
  return rows;
};

export const findById = async (fruitId) => {
  const [rows] = await pool.query(
    `SELECT fruit_id, fruit_name, description, status, created_at
       FROM fruits WHERE fruit_id = ?`,
    [fruitId],
  );
  return rows[0] ?? null;
};

/**
 * Registers a fruit and, in the same transaction, creates its three
 * packaging-specific stock rows plus default selling prices.
 */
export const create = async ({ fruit_name, description, status, prices }) => {
  return withTransaction(async (connection) => {
    const [result] = await connection.query(
      'INSERT INTO fruits (fruit_name, description, status) VALUES (?, ?, ?)',
      [fruit_name, description ?? null, status ?? 'ACTIVE'],
    );
    const fruitId = result.insertId;

    for (const size of PACKAGING_SIZES) {
      await connection.query(
        `INSERT INTO stock (fruit_id, packaging_size, available_quantity, low_stock_threshold)
         VALUES (?, ?, 0, 20)`,
        [fruitId, size],
      );
      const price = prices?.[size];
      if (price !== undefined && price !== null && price !== '') {
        await connection.query(
          `INSERT INTO fruit_prices (fruit_id, packaging_size, selling_price) VALUES (?, ?, ?)`,
          [fruitId, size, price],
        );
      }
    }

    return fruitId;
  });
};

export const update = async (fruitId, { fruit_name, description, status }) => {
  await pool.query(
    'UPDATE fruits SET fruit_name = ?, description = ?, status = ? WHERE fruit_id = ?',
    [fruit_name, description ?? null, status ?? 'ACTIVE', fruitId],
  );
  return findById(fruitId);
};

export const remove = async (fruitId) => {
  const [result] = await pool.query('DELETE FROM fruits WHERE fruit_id = ?', [fruitId]);
  return result.affectedRows > 0;
};

/** Referential guard: a fruit with purchase or sales history cannot be deleted. */
export const countHistory = async (fruitId) => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM purchase_details WHERE fruit_id = ?) AS purchases,
       (SELECT COUNT(*) FROM sale_details     WHERE fruit_id = ?) AS sales`,
    [fruitId, fruitId],
  );
  return {
    purchases: Number(rows[0].purchases),
    sales: Number(rows[0].sales),
  };
};

/** Stock for every fruit and packaging size, with a low-stock flag. */
export const findStock = async () => {
  const [rows] = await pool.query(
    `SELECT st.stock_id, st.fruit_id, f.fruit_name, st.packaging_size,
            st.available_quantity, st.low_stock_threshold,
            (st.available_quantity <= st.low_stock_threshold) AS is_low
       FROM stock st
       JOIN fruits f ON f.fruit_id = st.fruit_id
      ORDER BY f.fruit_name ASC,
               FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`,
  );
  return rows;
};

export const findLowStock = async () => {
  const [rows] = await pool.query(
    `SELECT st.stock_id, st.fruit_id, f.fruit_name, st.packaging_size,
            st.available_quantity, st.low_stock_threshold
       FROM stock st
       JOIN fruits f ON f.fruit_id = st.fruit_id
      WHERE st.available_quantity <= st.low_stock_threshold
      ORDER BY st.available_quantity ASC`,
  );
  return rows;
};

export const updateThreshold = async (stockId, threshold) => {
  await pool.query('UPDATE stock SET low_stock_threshold = ? WHERE stock_id = ?', [
    threshold,
    stockId,
  ]);
  const [rows] = await pool.query(
    `SELECT stock_id, fruit_id, packaging_size, available_quantity, low_stock_threshold
       FROM stock WHERE stock_id = ?`,
    [stockId],
  );
  return rows[0] ?? null;
};

export const findPrices = async () => {
  const [rows] = await pool.query(
    `SELECT price_id, fruit_id, packaging_size, selling_price
       FROM fruit_prices
      ORDER BY fruit_id ASC, FIELD(packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`,
  );
  return rows;
};

export const upsertPrice = async (fruitId, packagingSize, sellingPrice) => {
  await pool.query(
    `INSERT INTO fruit_prices (fruit_id, packaging_size, selling_price)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE selling_price = VALUES(selling_price)`,
    [fruitId, packagingSize, sellingPrice],
  );
};
