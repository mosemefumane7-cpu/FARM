import pool, { withTransaction } from '../config/db.js';
import { ApiError } from '../middleware/errorHandler.js';

/* ============================================================
 * PURCHASES
 * ============================================================ */

export const findPurchases = async () => {
  const [rows] = await pool.query(
    `SELECT p.purchase_id, p.supplier_id, s.business_name AS supplier_name,
            s.province, p.purchase_date, p.total_amount,
            (SELECT COUNT(*) FROM purchase_details pd WHERE pd.purchase_id = p.purchase_id) AS line_count
       FROM purchases p
       JOIN suppliers s ON s.supplier_id = p.supplier_id
      ORDER BY p.purchase_date DESC, p.purchase_id DESC`,
  );
  return rows;
};

export const findPurchaseById = async (purchaseId) => {
  const [rows] = await pool.query(
    `SELECT p.purchase_id, p.supplier_id, s.business_name AS supplier_name,
            s.province, p.purchase_date, p.total_amount
       FROM purchases p
       JOIN suppliers s ON s.supplier_id = p.supplier_id
      WHERE p.purchase_id = ?`,
    [purchaseId],
  );
  return rows[0] ?? null;
};

export const findPurchaseDetails = async (purchaseId) => {
  const [rows] = await pool.query(
    `SELECT pd.purchase_detail_id, pd.purchase_id, pd.fruit_id, f.fruit_name,
            pd.packaging_size, pd.quantity, pd.unit_cost,
            (pd.quantity * pd.unit_cost) AS subtotal
       FROM purchase_details pd
       JOIN fruits f ON f.fruit_id = pd.fruit_id
      WHERE pd.purchase_id = ?
      ORDER BY pd.purchase_detail_id ASC`,
    [purchaseId],
  );
  return rows;
};

/**
 * Records a multi-item purchase atomically: master row, every detail row and
 * every stock increment either all succeed or all roll back.
 */
export const createPurchase = async ({ supplier_id, purchase_date, items }) => {
  return withTransaction(async (connection) => {
    const [supplierRows] = await connection.query(
      'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
      [supplier_id],
    );
    if (supplierRows.length === 0) {
      throw new ApiError(404, 'Supplier not found.');
    }

    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    const [purchaseResult] = await connection.query(
      'INSERT INTO purchases (supplier_id, purchase_date, total_amount) VALUES (?, ?, ?)',
      [supplier_id, purchase_date, total],
    );
    const purchaseId = purchaseResult.insertId;

    for (const item of items) {
      const [fruitRows] = await connection.query(
        'SELECT fruit_name FROM fruits WHERE fruit_id = ?',
        [item.fruit_id],
      );
      if (fruitRows.length === 0) {
        throw new ApiError(400, `Fruit ${item.fruit_id} does not exist.`);
      }

      await connection.query(
        `INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, item.fruit_id, item.quantity, item.price, item.packaging_size],
      );

      const [stockResult] = await connection.query(
        `UPDATE stock SET available_quantity = available_quantity + ?
          WHERE fruit_id = ? AND packaging_size = ?`,
        [item.quantity, item.fruit_id, item.packaging_size],
      );
      if (stockResult.affectedRows === 0) {
        throw new ApiError(
          400,
          `No stock record exists for ${fruitRows[0].fruit_name} - ${item.packaging_size} packaging.`,
        );
      }

      if (!item.expiry_date) {
        throw new ApiError(400, 'An expiration date is required for every batch.');
      }

      const dateKey = purchase_date.replace(/-/g, '');
      let batchNumber = item.batch_number?.trim();
      if (!batchNumber) {
        const [seqRows] = await connection.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(batch_number, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq
             FROM stock_batches
            WHERE batch_number LIKE ?`,
          [`BATCH-${dateKey}-%`],
        );
        batchNumber = `BATCH-${dateKey}-${String(seqRows[0].next_seq).padStart(3, '0')}`;
      }

      const [existingBatch] = await connection.query(
        'SELECT batch_id FROM stock_batches WHERE batch_number = ?',
        [batchNumber],
      );
      if (existingBatch.length > 0) {
        throw new ApiError(400, `Batch number ${batchNumber} already exists.`);
      }

      await connection.query(
        `INSERT INTO stock_batches (batch_number, fruit_id, packaging_size, quantity_received,
                                    quantity_remaining, expiry_date, received_date, purchase_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchNumber,
          item.fruit_id,
          item.packaging_size,
          item.quantity,
          item.quantity,
          item.expiry_date,
          purchase_date,
          purchaseId,
        ],
      );
    }

    return { purchase_id: purchaseId, total_amount: total, line_count: items.length };
  });
};

/* ============================================================
 * SALES
 * ============================================================ */

export const findSales = async () => {
  const [rows] = await pool.query(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date,
            s.payment_status, s.payment_method, s.total_amount, s.amount_paid,
            (s.total_amount - s.amount_paid) AS outstanding,
            (SELECT COUNT(*) FROM sale_details sd WHERE sd.sale_id = s.sale_id) AS line_count
       FROM sales s
       JOIN vendors v ON v.vendor_id = s.vendor_id
      ORDER BY s.sale_date DESC, s.sale_id DESC`,
  );
  return rows;
};

export const findSaleById = async (saleId) => {
  const [rows] = await pool.query(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date,
            s.payment_status, s.payment_method, s.total_amount, s.amount_paid,
            (s.total_amount - s.amount_paid) AS outstanding
       FROM sales s
       JOIN vendors v ON v.vendor_id = s.vendor_id
      WHERE s.sale_id = ?`,
    [saleId],
  );
  return rows[0] ?? null;
};

export const findSaleDetails = async (saleId) => {
  const [rows] = await pool.query(
    `SELECT sd.sale_detail_id, sd.sale_id, sd.fruit_id, f.fruit_name,
            sd.packaging_size, sd.quantity, sd.unit_price,
            (sd.quantity * sd.unit_price) AS subtotal
       FROM sale_details sd
       JOIN fruits f ON f.fruit_id = sd.fruit_id
      WHERE sd.sale_id = ?
      ORDER BY sd.sale_detail_id ASC`,
    [saleId],
  );
  return rows;
};

export const findOutstandingSales = async () => {
  const [rows] = await pool.query(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date,
            s.payment_status, s.payment_method, s.total_amount, s.amount_paid,
            (s.total_amount - s.amount_paid) AS outstanding
       FROM sales s
       JOIN vendors v ON v.vendor_id = s.vendor_id
      WHERE s.amount_paid < s.total_amount
      ORDER BY s.sale_date ASC`,
  );
  return rows;
};

/**
 * Records a multi-item sale atomically.
 *
 * Three passes:
 *   1. aggregate requested quantities per fruit + packaging size
 *   2. lock and verify every stock row against the aggregated demand
 *   3. write the sale, its lines, decrement stock and settle if paid up front
 *
 * Any failure raises, which rolls the whole transaction back — no partial
 * sale and no stock movement survive.
 */
export const createSale = async ({ vendor_id, sale_date, payment_method, items }) => {
  return withTransaction(async (connection) => {
    const [vendorRows] = await connection.query(
      'SELECT vendor_id FROM vendors WHERE vendor_id = ?',
      [vendor_id],
    );
    if (vendorRows.length === 0) {
      throw new ApiError(404, 'Vendor not found.');
    }

    // Pass 1 — aggregate demand so duplicate lines cannot bypass the check
    const demand = new Map();
    for (const item of items) {
      const key = `${item.fruit_id}:${item.packaging_size}`;
      demand.set(key, (demand.get(key) ?? 0) + item.quantity);
    }

    // Pass 2 — lock and verify saleable (non-expired) batch stock
    for (const [key, requested] of demand.entries()) {
      const [fruitId, packagingSize] = key.split(':');
      const [stockRows] = await connection.query(
        `SELECT f.fruit_name,
                COALESCE(SUM(b.quantity_remaining), 0) AS physical,
                COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE()
                                  THEN b.quantity_remaining ELSE 0 END), 0) AS saleable
           FROM fruits f
           LEFT JOIN stock_batches b
                  ON b.fruit_id = f.fruit_id AND b.packaging_size = ?
          WHERE f.fruit_id = ?
          GROUP BY f.fruit_id, f.fruit_name`,
        [packagingSize, fruitId],
      );
      if (stockRows.length === 0) {
        throw new ApiError(400, `No stock record for fruit ${fruitId} - ${packagingSize}.`);
      }
      const saleable = Number(stockRows[0].saleable);
      const physical = Number(stockRows[0].physical);
      if (saleable < requested) {
        const reason =
          physical >= requested
            ? `available stock for ${stockRows[0].fruit_name} - ${packagingSize} packaging is expired`
            : `insufficient stock for ${stockRows[0].fruit_name} - ${packagingSize} packaging`;
        throw new ApiError(
          400,
          `Cannot fulfil order: ${reason}. Saleable: ${saleable} boxes, ` +
            `Requested: ${requested} boxes. Transaction cancelled.`,
        );
      }
    }

    // Pass 3 — write
    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const amountPaid = payment_method === 'CREDIT' ? 0 : total;
    const paymentStatus = amountPaid === 0 ? 'UNPAID' : 'PAID';

    const [saleResult] = await connection.query(
      `INSERT INTO sales (vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vendor_id, sale_date, paymentStatus, payment_method, total, amountPaid],
    );
    const saleId = saleResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO sale_details (sale_id, fruit_id, packaging_size, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, item.fruit_id, item.packaging_size, item.quantity, item.price],
      );
    }

    // Pass 4 — consume batches first-expiry-first-out
    for (const [key, requested] of demand.entries()) {
      const [fruitId, packagingSize] = key.split(':');
      let remaining = requested;

      const [batchRows] = await connection.query(
        `SELECT batch_id, quantity_remaining
           FROM stock_batches
          WHERE fruit_id = ? AND packaging_size = ?
            AND expiry_date >= CURDATE() AND quantity_remaining > 0
          ORDER BY expiry_date ASC, batch_id ASC
          FOR UPDATE`,
        [fruitId, packagingSize],
      );

      for (const batch of batchRows) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(batch.quantity_remaining));
        await connection.query(
          'UPDATE stock_batches SET quantity_remaining = quantity_remaining - ? WHERE batch_id = ?',
          [take, batch.batch_id],
        );
        await connection.query(
          `UPDATE stock SET available_quantity = available_quantity - ?
            WHERE fruit_id = ? AND packaging_size = ?`,
          [take, fruitId, packagingSize],
        );
        remaining -= take;
      }

      if (remaining > 0) {
        throw new ApiError(
          400,
          `Insufficient saleable stock for fruit ${fruitId} - ${packagingSize}. Transaction cancelled.`,
        );
      }
    }

    if (amountPaid > 0) {
      await connection.query(
        `INSERT INTO payments (sale_id, vendor_id, amount, payment_method, payment_date, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, vendor_id, amountPaid, payment_method, sale_date, 'Settled at point of sale'],
      );
    }

    return {
      sale_id: saleId,
      total_amount: total,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      line_count: items.length,
    };
  });
};

/* ============================================================
 * PAYMENTS
 * ============================================================ */

export const findPayments = async () => {
  const [rows] = await pool.query(
    `SELECT pay.payment_id, pay.sale_id, pay.vendor_id, v.vendor_name,
            pay.amount, pay.payment_method, pay.payment_date, pay.note
       FROM payments pay
       JOIN vendors v ON v.vendor_id = pay.vendor_id
      ORDER BY pay.payment_date DESC, pay.payment_id DESC`,
  );
  return rows;
};

export const findPaymentsBySale = async (saleId) => {
  const [rows] = await pool.query(
    `SELECT payment_id, sale_id, vendor_id, amount, payment_method, payment_date, note
       FROM payments WHERE sale_id = ? ORDER BY payment_date ASC`,
    [saleId],
  );
  return rows;
};

/** Records a settlement, rejecting overpayment and recalculating the status. */
export const createPayment = async ({ sale_id, amount, payment_method, payment_date, note }) => {
  return withTransaction(async (connection) => {
    const [saleRows] = await connection.query(
      `SELECT sale_id, vendor_id, total_amount, amount_paid
         FROM sales WHERE sale_id = ? FOR UPDATE`,
      [sale_id],
    );
    if (saleRows.length === 0) {
      throw new ApiError(404, 'Sale not found.');
    }

    const sale = saleRows[0];
    const total = Number(sale.total_amount);
    const alreadyPaid = Number(sale.amount_paid);
    const due = total - alreadyPaid;

    if (amount > due) {
      throw new ApiError(
        400,
        `Payment amount cannot exceed the outstanding balance of ${due.toFixed(2)}.`,
      );
    }

    const [paymentResult] = await connection.query(
      `INSERT INTO payments (sale_id, vendor_id, amount, payment_method, payment_date, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sale_id, sale.vendor_id, amount, payment_method, payment_date, note ?? null],
    );

    const newPaid = alreadyPaid + amount;
    const status = newPaid >= total ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    await connection.query(
      'UPDATE sales SET amount_paid = ?, payment_status = ? WHERE sale_id = ?',
      [newPaid, status, sale_id],
    );

    return {
      payment_id: paymentResult.insertId,
      sale_id,
      amount_paid: newPaid,
      outstanding: total - newPaid,
      payment_status: status,
    };
  });
};

/* ============================================================
 * REPORTS
 * ============================================================ */

/** Report 1 — the five most frequently sold fruits. */
export const reportTopFruits = async (limit = 5) => {
  const [rows] = await pool.query(
    `SELECT f.fruit_id, f.fruit_name,
            SUM(sd.quantity)                 AS total_boxes,
            SUM(sd.quantity * sd.unit_price) AS total_revenue,
            COUNT(DISTINCT sd.sale_id)       AS order_count
       FROM sale_details sd
       JOIN fruits f ON f.fruit_id = sd.fruit_id
      GROUP BY f.fruit_id, f.fruit_name
      ORDER BY total_boxes DESC, total_revenue DESC
      LIMIT ?`,
    [Number(limit)],
  );
  return rows;
};

/** Report 2 — total sales revenue for a specified date range, per day. */
export const reportRevenue = async (startDate, endDate) => {
  const [rows] = await pool.query(
    `SELECT s.sale_date AS report_date,
            SUM(sd.quantity * sd.unit_price) AS revenue,
            SUM(sd.quantity)                 AS boxes_sold,
            COUNT(DISTINCT s.sale_id)        AS order_count
       FROM sales s
       JOIN sale_details sd ON sd.sale_id = s.sale_id
      WHERE s.sale_date BETWEEN ? AND ?
      GROUP BY s.sale_date
      ORDER BY s.sale_date ASC`,
    [startDate, endDate],
  );
  return rows;
};

/** Report 3 — vendors ranked by the number of boxes purchased. */
export const reportTopVendors = async () => {
  const [rows] = await pool.query(
    `SELECT v.vendor_id, v.vendor_name, v.phone, v.location,
            SUM(sd.quantity)                 AS total_boxes,
            COUNT(DISTINCT s.sale_id)        AS order_count,
            SUM(sd.quantity * sd.unit_price) AS total_value
       FROM vendors v
       JOIN sales s         ON s.vendor_id = v.vendor_id
       JOIN sale_details sd ON sd.sale_id = s.sale_id
      GROUP BY v.vendor_id, v.vendor_name, v.phone, v.location
      ORDER BY total_boxes DESC`,
  );
  return rows;
};

/** Report 4 — current stock levels for each fruit and packaging size. */
export const reportStockLevels = async () => {
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

/** Outstanding balance per vendor. */
export const reportVendorBalances = async () => {
  const [rows] = await pool.query(
    `SELECT v.vendor_id, v.vendor_name, v.phone, v.location,
            COUNT(s.sale_id)                        AS sale_count,
            COALESCE(SUM(s.total_amount), 0)        AS total_billed,
            COALESCE(SUM(s.amount_paid), 0)         AS total_paid,
            COALESCE(SUM(s.total_amount - s.amount_paid), 0) AS outstanding_balance
       FROM vendors v
       LEFT JOIN sales s ON s.vendor_id = v.vendor_id
      GROUP BY v.vendor_id, v.vendor_name, v.phone, v.location
      ORDER BY outstanding_balance DESC, v.vendor_name ASC`,
  );
  return rows;
};

/** Aggregate KPIs for the dashboard. */
export const dashboardMetrics = async () => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COALESCE(SUM(total_amount), 0) FROM sales)                       AS total_revenue,
       (SELECT COALESCE(SUM(total_amount), 0) FROM purchases)                   AS total_purchases,
       (SELECT COALESCE(SUM(available_quantity), 0) FROM stock)                 AS total_stock_boxes,
       (SELECT COUNT(*) FROM stock WHERE available_quantity <= low_stock_threshold) AS low_stock_count,
       (SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM sales)         AS outstanding_balance,
       (SELECT COUNT(*) FROM suppliers)                                         AS supplier_count,
       (SELECT COUNT(*) FROM vendors)                                           AS vendor_count,
       (SELECT COUNT(*) FROM fruits WHERE status = 'ACTIVE')                    AS active_fruit_count,
       (SELECT COUNT(*) FROM sales)                                             AS sale_count,
       (SELECT COUNT(*) FROM purchases)                                         AS purchase_count`,
  );
  return rows[0];
};
