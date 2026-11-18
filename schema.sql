-- ============================================================
-- Batloung Farm Distribution Management System
-- Part A: MySQL database design and implementation
-- ============================================================
-- Run with:  mysql -u root -p < database/schema.sql
-- ============================================================

DROP DATABASE IF EXISTS batloung_farm;
CREATE DATABASE batloung_farm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE batloung_farm;

-- ------------------------------------------------------------
-- 1. SUPPLIERS
-- ------------------------------------------------------------
CREATE TABLE suppliers (
  supplier_id     INT AUTO_INCREMENT PRIMARY KEY,
  business_name   VARCHAR(120) NOT NULL UNIQUE,
  contact_person  VARCHAR(120) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  province        ENUM('Gauteng','Free State','KwaZulu-Natal','Western Cape',
                       'Eastern Cape','Limpopo','Mpumalanga','North West') NOT NULL,
  address         VARCHAR(200) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. FRUITS
-- ------------------------------------------------------------
CREATE TABLE fruits (
  fruit_id     INT AUTO_INCREMENT PRIMARY KEY,
  fruit_name   VARCHAR(60) NOT NULL UNIQUE,
  description  TEXT NULL,
  status       ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. VENDORS
-- ------------------------------------------------------------
CREATE TABLE vendors (
  vendor_id         INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name       VARCHAR(120) NOT NULL,
  phone             VARCHAR(20)  NOT NULL UNIQUE,
  location          VARCHAR(120) NOT NULL,
  registration_date DATE NOT NULL DEFAULT (CURRENT_DATE)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. PURCHASES
-- ------------------------------------------------------------
CREATE TABLE purchases (
  purchase_id    INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id    INT NOT NULL,
  purchase_date  DATE NOT NULL DEFAULT (CURRENT_DATE),
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers (supplier_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_purchases_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. PURCHASE DETAILS
-- ------------------------------------------------------------
CREATE TABLE purchase_details (
  purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id        INT NOT NULL,
  fruit_id           INT NOT NULL,
  quantity           INT NOT NULL,
  unit_cost          DECIMAL(10,2) NOT NULL,
  packaging_size     ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  CONSTRAINT fk_pd_purchase FOREIGN KEY (purchase_id)
    REFERENCES purchases (purchase_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pd_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_pd_quantity CHECK (quantity > 0),
  CONSTRAINT chk_pd_unit_cost CHECK (unit_cost > 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. SALES
-- ------------------------------------------------------------
CREATE TABLE sales (
  sale_id         INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT NOT NULL,
  sale_date       DATE NOT NULL DEFAULT (CURRENT_DATE),
  payment_status  ENUM('PAID','PARTIALLY_PAID','UNPAID') NOT NULL DEFAULT 'UNPAID',
  payment_method  ENUM('CASH','MOBILE_MONEY','CREDIT') NOT NULL DEFAULT 'CREDIT',
  total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount_paid     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (vendor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sales_total CHECK (total_amount >= 0),
  CONSTRAINT chk_sales_paid CHECK (amount_paid >= 0),
  CONSTRAINT chk_sales_paid_not_over_total CHECK (amount_paid <= total_amount)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. SALE DETAILS
-- ------------------------------------------------------------
CREATE TABLE sale_details (
  sale_detail_id  INT AUTO_INCREMENT PRIMARY KEY,
  sale_id         INT NOT NULL,
  fruit_id        INT NOT NULL,
  packaging_size  ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  quantity        INT NOT NULL,
  unit_price      DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_sd_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sd_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sd_quantity CHECK (quantity > 0),
  CONSTRAINT chk_sd_unit_price CHECK (unit_price > 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. STOCK  (one row per fruit x packaging size)
-- ------------------------------------------------------------
CREATE TABLE stock (
  stock_id            INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id            INT NOT NULL,
  packaging_size      ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  available_quantity  INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 20,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_stock_fruit_packaging UNIQUE (fruit_id, packaging_size),
  CONSTRAINT chk_stock_quantity CHECK (available_quantity >= 0),
  CONSTRAINT chk_stock_threshold CHECK (low_stock_threshold >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TRANSACTIONAL: stock batches (batch number + expiration date)
-- ------------------------------------------------------------
CREATE TABLE stock_batches (
  batch_id           INT AUTO_INCREMENT PRIMARY KEY,
  batch_number       VARCHAR(40) NOT NULL,
  fruit_id           INT NOT NULL,
  packaging_size     ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  quantity_received  INT NOT NULL,
  quantity_remaining INT NOT NULL,
  expiry_date        DATE NOT NULL,
  received_date      DATE NOT NULL,
  purchase_id        INT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_batch_number UNIQUE (batch_number),
  CONSTRAINT fk_batch_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_batch_purchase FOREIGN KEY (purchase_id)
    REFERENCES purchases (purchase_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_batch_received CHECK (quantity_received > 0),
  CONSTRAINT chk_batch_remaining CHECK (quantity_remaining >= 0),
  CONSTRAINT chk_batch_remaining_max CHECK (quantity_remaining <= quantity_received),
  INDEX idx_batch_fruit (fruit_id, packaging_size),
  INDEX idx_batch_expiry (expiry_date)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SUPPORTING: selling price per fruit x packaging size
-- ------------------------------------------------------------
CREATE TABLE fruit_prices (
  price_id       INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id       INT NOT NULL,
  packaging_size ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
  selling_price  DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_price_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_price_fruit_packaging UNIQUE (fruit_id, packaging_size),
  CONSTRAINT chk_price_positive CHECK (selling_price > 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SUPPORTING: vendor payments
-- ------------------------------------------------------------
CREATE TABLE payments (
  payment_id     INT AUTO_INCREMENT PRIMARY KEY,
  sale_id        INT NOT NULL,
  vendor_id      INT NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  payment_method ENUM('CASH','MOBILE_MONEY') NOT NULL,
  payment_date   DATE NOT NULL DEFAULT (CURRENT_DATE),
  note           VARCHAR(200) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pay_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (vendor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
CREATE INDEX idx_purchases_supplier   ON purchases (supplier_id);
CREATE INDEX idx_purchases_date       ON purchases (purchase_date);
CREATE INDEX idx_pd_purchase          ON purchase_details (purchase_id);
CREATE INDEX idx_pd_fruit             ON purchase_details (fruit_id);
CREATE INDEX idx_sales_vendor         ON sales (vendor_id);
CREATE INDEX idx_sales_date           ON sales (sale_date);
CREATE INDEX idx_sd_sale              ON sale_details (sale_id);
CREATE INDEX idx_sd_fruit             ON sale_details (fruit_id);
CREATE INDEX idx_payments_sale        ON payments (sale_id);
CREATE INDEX idx_payments_vendor      ON payments (vendor_id);
CREATE INDEX idx_vendors_name         ON vendors (vendor_name);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES
  ('Gauteng Fresh Produce (Pty) Ltd', 'Thabo Mokoena',    '+27 11 442 8890', 'Gauteng',       '14 Market Street, City Deep, Johannesburg'),
  ('Free State Harvest Co-op',        'Anna van Wyk',     '+27 51 447 2210', 'Free State',    '22 Bloem Plaza, Bloemfontein'),
  ('KZN Tropical Traders',            'Sipho Ndlovu',     '+27 31 305 7741', 'KwaZulu-Natal', '8 Victoria Embankment, Durban'),
  ('Cape Orchard Suppliers',          'Pieter de Klerk',  '+27 21 461 3320', 'Western Cape',  '45 Long Street, Cape Town'),
  ('Eastern Cape Citrus Growers',     'Nomsa Mbeki',      '+27 41 582 1190', 'Eastern Cape',  '3 Govan Mbeki Avenue, Port Elizabeth'),
  ('Limpopo Valley Farms',            'Johannes Sithole', '+27 15 291 6640', 'Limpopo',       '17 Landdros Mare Street, Polokwane'),
  ('Mpumalanga Fruit Link',           'Lerato Dlamini',   '+27 13 752 4408', 'Mpumalanga',    '9 Samora Machel Drive, Nelspruit'),
  ('North West Agri Supply',          'Kagiso Molefe',    '+27 18 381 2277', 'North West',    '26 Oliver Tambo Way, Rustenburg');

INSERT INTO fruits (fruit_name, description, status) VALUES
  ('Apples',  'Crisp red apples sourced from Western Cape orchards.',       'ACTIVE'),
  ('Bananas', 'Ripening bananas from Limpopo and Mpumalanga plantations.',  'ACTIVE'),
  ('Oranges', 'Juicy citrus oranges from Eastern Cape groves.',             'ACTIVE'),
  ('Mangoes', 'Sweet seasonal mangoes from the Limpopo Valley.',            'ACTIVE'),
  ('Grapes',  'Seedless table grapes from Western Cape vineyards.',         'ACTIVE');

INSERT INTO vendors (vendor_name, phone, location, registration_date) VALUES
  ('Mamello Fruit Stall',      '+266 5812 4471', 'Maseru Market, Maseru',          '2025-01-14'),
  ('Thabo Street Fruits',      '+266 6290 1183', 'Teyateyaneng, Berea',            '2025-02-03'),
  ('Lerato Produce Corner',    '+266 5877 6620', 'Mafeteng Town Centre, Mafeteng', '2025-02-19'),
  ('Hlotse Fresh Cart',        '+266 6304 2298', 'Hlotse, Leribe',                 '2025-03-08'),
  ('Mohale''s Hoek Fruit Hub', '+266 5791 3345', 'Mohale''s Hoek',                 '2025-04-02'),
  ('Maputsoe Vendors Union',   '+266 6218 7706', 'Maputsoe, Leribe',               '2025-05-21'),
  ('Quthing Roadside Fruits',  '+266 5844 9902', 'Quthing',                        '2025-06-11'),
  ('Butha-Buthe Market Stall', '+266 6355 4417', 'Butha-Buthe',                    '2025-07-30');

-- Each packaging size carries a different selling price
INSERT INTO fruit_prices (fruit_id, packaging_size, selling_price) VALUES
  (1,'SMALL',32.00),(1,'MEDIUM',58.00),(1,'LARGE',92.00),
  (2,'SMALL',26.00),(2,'MEDIUM',48.00),(2,'LARGE',78.00),
  (3,'SMALL',29.00),(3,'MEDIUM',54.00),(3,'LARGE',86.00),
  (4,'SMALL',38.00),(4,'MEDIUM',68.00),(4,'LARGE',108.00),
  (5,'SMALL',45.00),(5,'MEDIUM',82.00),(5,'LARGE',132.00);

-- Final stock balances (one row per fruit x packaging size)
INSERT INTO stock (fruit_id, packaging_size, available_quantity, low_stock_threshold) VALUES
  (1,'SMALL',30,20),(1,'MEDIUM',53,20),(1,'LARGE',10,20),
  (2,'SMALL',105,20),(2,'MEDIUM',70,20),(2,'LARGE',67,20),
  (3,'SMALL',60,20),(3,'MEDIUM',18,20),(3,'LARGE',60,20),
  (4,'SMALL',12,20),(4,'MEDIUM',55,20),(4,'LARGE',34,20),
  (5,'SMALL',43,20),(5,'MEDIUM',4,20),(5,'LARGE',41,20);

-- Opening batches: one per stock row so batch balances match stock on hand
INSERT INTO stock_batches (
  batch_number, fruit_id, packaging_size, quantity_received,
  quantity_remaining, expiry_date, received_date, purchase_id
)
SELECT CONCAT('BATCH-OPENING-', LPAD(s.fruit_id, 2, '0'), '-', LEFT(s.packaging_size, 1)),
       s.fruit_id,
       s.packaging_size,
       s.available_quantity,
       s.available_quantity,
       CASE
         WHEN s.fruit_id = 5 AND s.packaging_size = 'MEDIUM' THEN DATE_SUB(CURDATE(), INTERVAL 3 DAY)
         WHEN s.packaging_size = 'LARGE'  THEN DATE_ADD(CURDATE(), INTERVAL 6 DAY)
         WHEN s.packaging_size = 'MEDIUM' THEN DATE_ADD(CURDATE(), INTERVAL 20 DAY)
         ELSE DATE_ADD(CURDATE(), INTERVAL 60 DAY)
       END,
       DATE_SUB(CURDATE(), INTERVAL 30 DAY),
       NULL
  FROM stock s
 WHERE s.available_quantity > 0;

-- Purchases
INSERT INTO purchases (purchase_id, supplier_id, purchase_date, total_amount) VALUES
  (1, 1, '2026-09-05', 2270.00),
  (2, 4, '2026-09-18', 5680.00),
  (3, 6, '2026-10-02', 3880.00),
  (4, 5, '2026-10-16', 3090.00),
  (5, 3, '2026-10-29', 3850.00);

INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES
  (1, 1, 10, 62.00, 'LARGE'),
  (1, 2, 50, 33.00, 'MEDIUM'),
  (2, 5, 30, 88.00, 'LARGE'),
  (2, 1, 60, 38.00, 'MEDIUM'),
  (2, 3, 40, 19.00, 'SMALL'),
  (3, 2, 45, 52.00, 'LARGE'),
  (3, 4, 35, 44.00, 'MEDIUM'),
  (4, 3, 50, 55.00, 'LARGE'),
  (4, 3, 10, 34.00, 'MEDIUM'),
  (5, 2, 70, 16.00, 'SMALL'),
  (5, 4, 25, 70.00, 'LARGE'),
  (5, 5, 35, 28.00, 'SMALL');

-- Sales
INSERT INTO sales (sale_id, vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid) VALUES
  (1, 1, '2026-09-12', 'PAID',           'CASH',         848.00,  848.00),
  (2, 2, '2026-09-20', 'PARTIALLY_PAID', 'CREDIT',      1488.00,  800.00),
  (3, 3, '2026-09-27', 'PAID',           'MOBILE_MONEY',1059.00, 1059.00),
  (4, 1, '2026-10-05', 'UNPAID',         'CREDIT',      1090.00,    0.00),
  (5, 4, '2026-10-12', 'PAID',           'CASH',        2192.00, 2192.00),
  (6, 5, '2026-10-21', 'PARTIALLY_PAID', 'CREDIT',      1618.00,  600.00),
  (7, 2, '2026-11-02', 'PAID',           'MOBILE_MONEY',1596.00, 1596.00),
  (8, 6, '2026-11-10', 'UNPAID',         'CREDIT',      1444.00,    0.00);

INSERT INTO sale_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES
  (1, 1, 'LARGE',   4,  92.00),
  (1, 2, 'MEDIUM', 10,  48.00),
  (2, 5, 'LARGE',   6, 132.00),
  (2, 1, 'MEDIUM', 12,  58.00),
  (3, 3, 'SMALL',  15,  29.00),
  (3, 2, 'LARGE',   8,  78.00),
  (4, 4, 'MEDIUM', 10,  68.00),
  (4, 5, 'MEDIUM',  5,  82.00),
  (5, 1, 'MEDIUM', 20,  58.00),
  (5, 3, 'LARGE',  12,  86.00),
  (6, 2, 'SMALL',  25,  26.00),
  (6, 4, 'LARGE',   6, 108.00),
  (6, 1, 'SMALL',  10,  32.00),
  (7, 5, 'LARGE',   8, 132.00),
  (7, 3, 'MEDIUM', 10,  54.00),
  (8, 1, 'LARGE',   2,  92.00),
  (8, 2, 'MEDIUM', 15,  48.00),
  (8, 5, 'SMALL',  12,  45.00);

INSERT INTO payments (sale_id, vendor_id, amount, payment_method, payment_date, note) VALUES
  (1, 1,  848.00, 'CASH',         '2026-09-12', 'Settled at point of sale'),
  (2, 2,  800.00, 'CASH',         '2026-09-25', NULL),
  (3, 3, 1059.00, 'MOBILE_MONEY', '2026-09-27', 'Settled at point of sale'),
  (5, 4, 2192.00, 'CASH',         '2026-10-12', 'Settled at point of sale'),
  (6, 5,  600.00, 'MOBILE_MONEY', '2026-10-28', NULL),
  (7, 2, 1596.00, 'MOBILE_MONEY', '2026-11-02', 'Settled at point of sale');

-- ============================================================
-- PART D: REPORTING QUERIES
-- ============================================================

-- Report 1: the five most frequently sold fruits
SELECT f.fruit_id,
       f.fruit_name,
       SUM(sd.quantity)                        AS total_boxes,
       SUM(sd.quantity * sd.unit_price)        AS total_revenue,
       COUNT(DISTINCT sd.sale_id)              AS order_count
FROM sale_details sd
JOIN fruits f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY total_boxes DESC, total_revenue DESC
LIMIT 5;

-- Report 2: total sales revenue for a specified date range
--   Replace the dates with the reporting period.
SELECT SUM(sd.quantity * sd.unit_price) AS total_revenue,
       SUM(sd.quantity)                 AS boxes_sold,
       COUNT(DISTINCT s.sale_id)        AS order_count
FROM sales s
JOIN sale_details sd ON sd.sale_id = s.sale_id
WHERE s.sale_date BETWEEN '2026-09-01' AND '2026-11-30';

-- Report 3: the vendor who purchased the highest number of boxes
SELECT v.vendor_id,
       v.vendor_name,
       v.phone,
       v.location,
       SUM(sd.quantity)                 AS total_boxes,
       COUNT(DISTINCT s.sale_id)        AS order_count,
       SUM(sd.quantity * sd.unit_price) AS total_value
FROM vendors v
JOIN sales s        ON s.vendor_id = v.vendor_id
JOIN sale_details sd ON sd.sale_id = s.sale_id
GROUP BY v.vendor_id, v.vendor_name, v.phone, v.location
ORDER BY total_boxes DESC
LIMIT 1;

-- Report 4: current stock levels for each fruit and packaging size
SELECT f.fruit_id,
       f.fruit_name,
       st.packaging_size,
       st.available_quantity,
       st.low_stock_threshold,
       (st.available_quantity <= st.low_stock_threshold) AS is_low
FROM stock st
JOIN fruits f ON f.fruit_id = st.fruit_id
ORDER BY f.fruit_name,
         FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE');
