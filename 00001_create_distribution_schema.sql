-- ============================================================
-- Batloung Farm Distribution Management System
-- Part A: Relational schema (8 core tables + 2 supporting tables)
-- ============================================================

-- 1. SUPPLIERS -------------------------------------------------
CREATE TABLE public.suppliers (
  supplier_id     SERIAL PRIMARY KEY,
  business_name   VARCHAR(120) NOT NULL UNIQUE,
  contact_person  VARCHAR(120) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  province        VARCHAR(40)  NOT NULL
                  CHECK (province IN ('Gauteng','Free State','KwaZulu-Natal','Western Cape',
                                      'Eastern Cape','Limpopo','Mpumalanga','North West')),
  address         VARCHAR(200) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. FRUITS ----------------------------------------------------
CREATE TABLE public.fruits (
  fruit_id     SERIAL PRIMARY KEY,
  fruit_name   VARCHAR(60) NOT NULL UNIQUE,
  description  TEXT,
  status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. VENDORS ---------------------------------------------------
CREATE TABLE public.vendors (
  vendor_id         SERIAL PRIMARY KEY,
  vendor_name       VARCHAR(120) NOT NULL,
  phone             VARCHAR(20)  NOT NULL UNIQUE,
  location          VARCHAR(120) NOT NULL,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 4. PURCHASES -------------------------------------------------
CREATE TABLE public.purchases (
  purchase_id    SERIAL PRIMARY KEY,
  supplier_id    INTEGER NOT NULL REFERENCES public.suppliers(supplier_id) ON DELETE RESTRICT,
  purchase_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PURCHASE DETAILS ------------------------------------------
CREATE TABLE public.purchase_details (
  purchase_detail_id SERIAL PRIMARY KEY,
  purchase_id        INTEGER NOT NULL REFERENCES public.purchases(purchase_id) ON DELETE CASCADE,
  fruit_id           INTEGER NOT NULL REFERENCES public.fruits(fruit_id) ON DELETE RESTRICT,
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost          NUMERIC(10,2) NOT NULL CHECK (unit_cost > 0),
  packaging_size     VARCHAR(10) NOT NULL CHECK (packaging_size IN ('SMALL','MEDIUM','LARGE'))
);

-- 6. SALES -----------------------------------------------------
CREATE TABLE public.sales (
  sale_id         SERIAL PRIMARY KEY,
  vendor_id       INTEGER NOT NULL REFERENCES public.vendors(vendor_id) ON DELETE RESTRICT,
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
                  CHECK (payment_status IN ('PAID','PARTIALLY_PAID','UNPAID')),
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'CREDIT'
                  CHECK (payment_method IN ('CASH','MOBILE_MONEY','CREDIT')),
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_paid_not_over_total CHECK (amount_paid <= total_amount)
);

-- 7. SALE DETAILS ----------------------------------------------
CREATE TABLE public.sale_details (
  sale_detail_id  SERIAL PRIMARY KEY,
  sale_id         INTEGER NOT NULL REFERENCES public.sales(sale_id) ON DELETE CASCADE,
  fruit_id        INTEGER NOT NULL REFERENCES public.fruits(fruit_id) ON DELETE RESTRICT,
  packaging_size  VARCHAR(10) NOT NULL CHECK (packaging_size IN ('SMALL','MEDIUM','LARGE')),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(10,2) NOT NULL CHECK (unit_price > 0)
);

-- 8. STOCK (one row per fruit x packaging size) ----------------
CREATE TABLE public.stock (
  stock_id            SERIAL PRIMARY KEY,
  fruit_id            INTEGER NOT NULL REFERENCES public.fruits(fruit_id) ON DELETE CASCADE,
  packaging_size      VARCHAR(10) NOT NULL CHECK (packaging_size IN ('SMALL','MEDIUM','LARGE')),
  available_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 20 CHECK (low_stock_threshold >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_fruit_packaging_unique UNIQUE (fruit_id, packaging_size)
);

-- SUPPORTING: selling price per fruit x packaging size ---------
CREATE TABLE public.fruit_prices (
  price_id       SERIAL PRIMARY KEY,
  fruit_id       INTEGER NOT NULL REFERENCES public.fruits(fruit_id) ON DELETE CASCADE,
  packaging_size VARCHAR(10) NOT NULL CHECK (packaging_size IN ('SMALL','MEDIUM','LARGE')),
  selling_price  NUMERIC(10,2) NOT NULL CHECK (selling_price > 0),
  CONSTRAINT fruit_prices_unique UNIQUE (fruit_id, packaging_size)
);

-- SUPPORTING: vendor payments ----------------------------------
CREATE TABLE public.payments (
  payment_id     SERIAL PRIMARY KEY,
  sale_id        INTEGER NOT NULL REFERENCES public.sales(sale_id) ON DELETE CASCADE,
  vendor_id      INTEGER NOT NULL REFERENCES public.vendors(vendor_id) ON DELETE RESTRICT,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH','MOBILE_MONEY')),
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  note           VARCHAR(200),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES ------------------------------------------------------
CREATE INDEX idx_purchases_supplier   ON public.purchases(supplier_id);
CREATE INDEX idx_purchases_date       ON public.purchases(purchase_date);
CREATE INDEX idx_purchase_details_pid ON public.purchase_details(purchase_id);
CREATE INDEX idx_purchase_details_fid ON public.purchase_details(fruit_id);
CREATE INDEX idx_sales_vendor         ON public.sales(vendor_id);
CREATE INDEX idx_sales_date           ON public.sales(sale_date);
CREATE INDEX idx_sale_details_sid     ON public.sale_details(sale_id);
CREATE INDEX idx_sale_details_fid     ON public.sale_details(fruit_id);
CREATE INDEX idx_payments_sale        ON public.payments(sale_id);
CREATE INDEX idx_payments_vendor      ON public.payments(vendor_id);
CREATE INDEX idx_vendors_name         ON public.vendors(lower(vendor_name));

-- ROW LEVEL SECURITY -------------------------------------------
-- Single-administrator internal tool: the admin console is the only client.
ALTER TABLE public.suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_details     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_prices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','fruits','vendors','purchases','purchase_details',
                           'sales','sale_details','stock','fruit_prices','payments']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO anon, authenticated USING (true)', t || '_delete', t);
  END LOOP;
END $$;