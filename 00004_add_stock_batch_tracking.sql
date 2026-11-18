-- ============================================================
-- Batch tracking numbers and expiration dates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_batches (
  batch_id           serial PRIMARY KEY,
  batch_number       varchar(40) NOT NULL UNIQUE,
  fruit_id           integer NOT NULL REFERENCES public.fruits(fruit_id) ON DELETE CASCADE,
  packaging_size     varchar(10) NOT NULL CHECK (packaging_size IN ('SMALL','MEDIUM','LARGE')),
  quantity_received  integer NOT NULL CHECK (quantity_received > 0),
  quantity_remaining integer NOT NULL CHECK (quantity_remaining >= 0),
  expiry_date        date NOT NULL,
  received_date      date NOT NULL DEFAULT CURRENT_DATE,
  purchase_id        integer REFERENCES public.purchases(purchase_id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_batches_remaining_within_received CHECK (quantity_remaining <= quantity_received)
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_fruit  ON public.stock_batches (fruit_id, packaging_size);
CREATE INDEX IF NOT EXISTS idx_stock_batches_expiry ON public.stock_batches (expiry_date);

ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_batches_select ON public.stock_batches;
CREATE POLICY stock_batches_select ON public.stock_batches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS stock_batches_insert ON public.stock_batches;
CREATE POLICY stock_batches_insert ON public.stock_batches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS stock_batches_update ON public.stock_batches;
CREATE POLICY stock_batches_update ON public.stock_batches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS stock_batches_delete ON public.stock_batches;
CREATE POLICY stock_batches_delete ON public.stock_batches FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_batch_sequence(p_date date)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX((regexp_replace(batch_number, '^.*-', ''))::int), 0) + 1
    FROM public.stock_batches
   WHERE batch_number LIKE 'BATCH-' || to_char(p_date, 'YYYYMMDD') || '-%'
     AND regexp_replace(batch_number, '^.*-', '') ~ '^[0-9]+$';
$$;

CREATE OR REPLACE FUNCTION public.suggest_batch_numbers(p_date date DEFAULT CURRENT_DATE, p_count integer DEFAULT 1)
RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT array_agg('BATCH-' || to_char(p_date, 'YYYYMMDD') || '-' ||
                   lpad((public.next_batch_sequence(p_date) + i - 1)::text, 3, '0') ORDER BY i)
    FROM generate_series(1, GREATEST(p_count, 1)) AS i;
$$;

CREATE OR REPLACE FUNCTION public.sync_stock_from_batches()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_fruit_id integer;
  v_size     varchar(10);
BEGIN
  v_fruit_id := COALESCE(NEW.fruit_id, OLD.fruit_id);
  v_size     := COALESCE(NEW.packaging_size, OLD.packaging_size);

  UPDATE public.stock s
     SET available_quantity = COALESCE((
           SELECT SUM(b.quantity_remaining)::int
             FROM public.stock_batches b
            WHERE b.fruit_id = v_fruit_id AND b.packaging_size = v_size
         ), 0),
         updated_at = now()
   WHERE s.fruit_id = v_fruit_id AND s.packaging_size = v_size;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_from_batches ON public.stock_batches;
CREATE TRIGGER trg_sync_stock_from_batches
AFTER INSERT OR UPDATE OR DELETE ON public.stock_batches
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_from_batches();

INSERT INTO public.stock_batches (
  batch_number, fruit_id, packaging_size, quantity_received,
  quantity_remaining, expiry_date, received_date, purchase_id
)
SELECT 'BATCH-OPENING-' || lpad(s.fruit_id::text, 2, '0') || '-' || left(s.packaging_size, 1),
       s.fruit_id, s.packaging_size, s.available_quantity, s.available_quantity,
       CASE
         WHEN s.fruit_id = 5 AND s.packaging_size = 'MEDIUM' THEN CURRENT_DATE - 3
         WHEN s.packaging_size = 'LARGE'  THEN CURRENT_DATE + 6
         WHEN s.packaging_size = 'MEDIUM' THEN CURRENT_DATE + 20
         ELSE CURRENT_DATE + 60
       END,
       CURRENT_DATE - 30, NULL
  FROM public.stock s
 WHERE s.available_quantity > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.stock_batches b
      WHERE b.fruit_id = s.fruit_id AND b.packaging_size = s.packaging_size
   );

DROP FUNCTION IF EXISTS public.record_purchase(integer, date, jsonb);
CREATE FUNCTION public.record_purchase(
  p_supplier_id integer,
  p_purchase_date date,
  p_items jsonb
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_purchase_id  integer;
  v_total        numeric(12,2) := 0;
  v_item         jsonb;
  v_normalized   jsonb := '[]'::jsonb;
  v_fruit_id     integer;
  v_size         varchar(10);
  v_qty          integer;
  v_cost         numeric(10,2);
  v_batch_number varchar(40);
  v_expiry       date;
  v_fruit_name   varchar(60);
  v_line         integer := 0;
  v_auto_seq     integer;
  v_used_batches varchar(40)[] := '{}';
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Please add at least one fruit line item.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE supplier_id = p_supplier_id) THEN
    RAISE EXCEPTION 'Supplier not found.';
  END IF;

  v_auto_seq := public.next_batch_sequence(p_purchase_date);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line := v_line + 1;
    v_fruit_id := (v_item->>'fruit_id')::int;
    v_size     := upper(v_item->>'packaging_size');
    v_qty      := (v_item->>'quantity')::int;
    v_cost     := (v_item->>'unit_cost')::numeric;

    IF v_size NOT IN ('SMALL','MEDIUM','LARGE') THEN
      RAISE EXCEPTION 'Line %: packaging size must be SMALL, MEDIUM or LARGE.', v_line;
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line %: quantity must be a positive whole number.', v_line;
    END IF;
    IF v_cost IS NULL OR v_cost <= 0 THEN
      RAISE EXCEPTION 'Line %: unit cost must be greater than zero.', v_line;
    END IF;

    SELECT fruit_name INTO v_fruit_name FROM public.fruits WHERE fruit_id = v_fruit_id;
    IF v_fruit_name IS NULL THEN
      RAISE EXCEPTION 'Line %: fruit does not exist.', v_line;
    END IF;

    v_expiry := NULLIF(v_item->>'expiry_date', '')::date;
    IF v_expiry IS NULL THEN
      RAISE EXCEPTION 'Line %: an expiration date is required.', v_line;
    END IF;
    IF v_expiry < p_purchase_date THEN
      RAISE EXCEPTION 'Line %: expiration date cannot be before the purchase date.', v_line;
    END IF;

    v_batch_number := NULLIF(trim(v_item->>'batch_number'), '');
    IF v_batch_number IS NULL THEN
      LOOP
        v_batch_number := 'BATCH-' || to_char(p_purchase_date, 'YYYYMMDD') || '-' ||
                          lpad(v_auto_seq::text, 3, '0');
        v_auto_seq := v_auto_seq + 1;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.stock_batches WHERE batch_number = v_batch_number)
                  AND NOT (v_batch_number = ANY(v_used_batches));
      END LOOP;
    END IF;

    IF v_batch_number = ANY(v_used_batches) THEN
      RAISE EXCEPTION 'Batch number % is used twice in this purchase.', v_batch_number;
    END IF;
    IF EXISTS (SELECT 1 FROM public.stock_batches WHERE batch_number = v_batch_number) THEN
      RAISE EXCEPTION 'Batch number % already exists. Please use a unique batch number.', v_batch_number;
    END IF;

    v_used_batches := array_append(v_used_batches, v_batch_number);
    v_total := v_total + (v_qty * v_cost);

    v_normalized := v_normalized || jsonb_build_object(
      'fruit_id', v_fruit_id, 'packaging_size', v_size, 'quantity', v_qty,
      'unit_cost', v_cost, 'batch_number', v_batch_number, 'expiry_date', v_expiry
    );
  END LOOP;

  INSERT INTO public.purchases (supplier_id, purchase_date, total_amount)
  VALUES (p_supplier_id, p_purchase_date, v_total)
  RETURNING purchase_id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_normalized) LOOP
    INSERT INTO public.purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
    VALUES (v_purchase_id, (v_item->>'fruit_id')::int, (v_item->>'quantity')::int,
            (v_item->>'unit_cost')::numeric, v_item->>'packaging_size');

    INSERT INTO public.stock_batches (
      batch_number, fruit_id, packaging_size, quantity_received,
      quantity_remaining, expiry_date, received_date, purchase_id
    )
    VALUES (v_item->>'batch_number', (v_item->>'fruit_id')::int, v_item->>'packaging_size',
            (v_item->>'quantity')::int, (v_item->>'quantity')::int,
            (v_item->>'expiry_date')::date, p_purchase_date, v_purchase_id);
  END LOOP;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'total_amount', v_total,
                            'line_count', jsonb_array_length(v_normalized));
END;
$$;

DROP FUNCTION IF EXISTS public.record_sale(integer, date, jsonb, text);
CREATE FUNCTION public.record_sale(
  p_vendor_id integer,
  p_sale_date date,
  p_items jsonb,
  p_payment_method text
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_sale_id    integer;
  v_total      numeric(12,2) := 0;
  v_paid       numeric(12,2);
  v_status     varchar(20);
  v_item       jsonb;
  v_fruit_id   integer;
  v_size       varchar(10);
  v_qty        integer;
  v_price      numeric(10,2);
  v_fruit_name varchar(60);
  v_line       integer := 0;
  v_demand     record;
  v_saleable   integer;
  v_physical   integer;
  v_remaining  integer;
  v_take       integer;
  v_batch      record;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Please add at least one fruit line item.';
  END IF;

  IF p_payment_method NOT IN ('CASH','MOBILE_MONEY','CREDIT') THEN
    RAISE EXCEPTION 'Payment method must be CASH, MOBILE_MONEY or CREDIT.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE vendor_id = p_vendor_id) THEN
    RAISE EXCEPTION 'Vendor not found.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line := v_line + 1;
    v_fruit_id := (v_item->>'fruit_id')::int;
    v_size     := upper(v_item->>'packaging_size');
    v_qty      := (v_item->>'quantity')::int;
    v_price    := (v_item->>'unit_price')::numeric;

    IF v_size NOT IN ('SMALL','MEDIUM','LARGE') THEN
      RAISE EXCEPTION 'Line %: packaging size must be SMALL, MEDIUM or LARGE.', v_line;
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line %: quantity must be a positive whole number.', v_line;
    END IF;
    IF v_price IS NULL OR v_price <= 0 THEN
      RAISE EXCEPTION 'Line %: unit price must be greater than zero.', v_line;
    END IF;

    SELECT fruit_name INTO v_fruit_name FROM public.fruits WHERE fruit_id = v_fruit_id;
    IF v_fruit_name IS NULL THEN
      RAISE EXCEPTION 'Line %: fruit does not exist.', v_line;
    END IF;

    v_total := v_total + (v_qty * v_price);
  END LOOP;

  FOR v_demand IN
    SELECT (item->>'fruit_id')::int AS fruit_id,
           upper(item->>'packaging_size') AS packaging_size,
           SUM((item->>'quantity')::int)::int AS quantity
      FROM jsonb_array_elements(p_items) AS item
     GROUP BY 1, 2
  LOOP
    SELECT fruit_name INTO v_fruit_name FROM public.fruits WHERE fruit_id = v_demand.fruit_id;

    SELECT COALESCE(SUM(b.quantity_remaining), 0)::int INTO v_physical
      FROM public.stock_batches b
     WHERE b.fruit_id = v_demand.fruit_id AND b.packaging_size = v_demand.packaging_size;

    SELECT COALESCE(SUM(b.quantity_remaining), 0)::int INTO v_saleable
      FROM public.stock_batches b
     WHERE b.fruit_id = v_demand.fruit_id AND b.packaging_size = v_demand.packaging_size
       AND b.expiry_date >= CURRENT_DATE;

    IF v_saleable < v_demand.quantity THEN
      IF v_physical >= v_demand.quantity THEN
        RAISE EXCEPTION
          'Cannot fulfil order: available stock for % - % packaging is expired. Saleable: % boxes, Requested: % boxes. Transaction cancelled.',
          v_fruit_name, initcap(lower(v_demand.packaging_size)), v_saleable, v_demand.quantity;
      ELSE
        RAISE EXCEPTION
          'Insufficient stock for % - % packaging. Available: % boxes, Requested: % boxes. Transaction cancelled.',
          v_fruit_name, initcap(lower(v_demand.packaging_size)), v_saleable, v_demand.quantity;
      END IF;
    END IF;
  END LOOP;

  v_paid   := CASE WHEN p_payment_method = 'CREDIT' THEN 0 ELSE v_total END;
  v_status := CASE WHEN v_paid = 0 THEN 'UNPAID' ELSE 'PAID' END;

  INSERT INTO public.sales (vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid)
  VALUES (p_vendor_id, p_sale_date, v_status, p_payment_method, v_total, v_paid)
  RETURNING sale_id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.sale_details (sale_id, fruit_id, packaging_size, quantity, unit_price)
    VALUES (v_sale_id, (v_item->>'fruit_id')::int, upper(v_item->>'packaging_size'),
            (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric);
  END LOOP;

  FOR v_demand IN
    SELECT (item->>'fruit_id')::int AS fruit_id,
           upper(item->>'packaging_size') AS packaging_size,
           SUM((item->>'quantity')::int)::int AS quantity
      FROM jsonb_array_elements(p_items) AS item
     GROUP BY 1, 2
  LOOP
    v_remaining := v_demand.quantity;

    FOR v_batch IN
      SELECT batch_id, quantity_remaining
        FROM public.stock_batches
       WHERE fruit_id = v_demand.fruit_id
         AND packaging_size = v_demand.packaging_size
         AND expiry_date >= CURRENT_DATE
         AND quantity_remaining > 0
       ORDER BY expiry_date ASC, batch_id ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_batch.quantity_remaining);
      UPDATE public.stock_batches
         SET quantity_remaining = quantity_remaining - v_take
       WHERE batch_id = v_batch.batch_id;
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for fruit % - % packaging. Transaction cancelled.',
        v_demand.fruit_id, v_demand.packaging_size;
    END IF;
  END LOOP;

  IF v_paid > 0 THEN
    INSERT INTO public.payments (sale_id, vendor_id, amount, payment_method, payment_date, note)
    VALUES (v_sale_id, p_vendor_id, v_paid, p_payment_method, p_sale_date, 'Settled at point of sale');
  END IF;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'total_amount', v_total,
                            'amount_paid', v_paid, 'payment_status', v_status,
                            'line_count', jsonb_array_length(p_items));
END;
$$;

DROP FUNCTION IF EXISTS public.list_batches(varchar);
CREATE FUNCTION public.list_batches(p_status varchar DEFAULT NULL)
RETURNS TABLE(
  batch_id integer, batch_number varchar, fruit_id integer, fruit_name varchar,
  packaging_size varchar, quantity_received integer, quantity_remaining integer,
  expiry_date date, received_date date, purchase_id integer,
  days_until_expiry integer, expiry_status varchar
)
LANGUAGE sql STABLE AS $$
  SELECT b.batch_id, b.batch_number, b.fruit_id, f.fruit_name, b.packaging_size,
         b.quantity_received, b.quantity_remaining, b.expiry_date, b.received_date, b.purchase_id,
         (b.expiry_date - CURRENT_DATE)::int,
         CASE
           WHEN b.expiry_date < CURRENT_DATE THEN 'EXPIRED'
           WHEN b.expiry_date <= CURRENT_DATE + 7 THEN 'EXPIRING_SOON'
           ELSE 'FRESH'
         END
    FROM public.stock_batches b
    JOIN public.fruits f ON f.fruit_id = b.fruit_id
   WHERE p_status IS NULL
      OR upper(p_status) = 'ALL'
      OR (upper(p_status) = 'EXPIRED'       AND b.expiry_date < CURRENT_DATE)
      OR (upper(p_status) = 'EXPIRING_SOON' AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + 7)
      OR (upper(p_status) = 'FRESH'         AND b.expiry_date > CURRENT_DATE + 7)
   ORDER BY f.fruit_name ASC,
            CASE b.packaging_size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
            b.expiry_date ASC, b.batch_id ASC;
$$;

DROP FUNCTION IF EXISTS public.stock_batches_for(integer, varchar);
CREATE FUNCTION public.stock_batches_for(p_fruit_id integer, p_packaging_size varchar)
RETURNS TABLE(
  batch_id integer, batch_number varchar, fruit_id integer, fruit_name varchar,
  packaging_size varchar, quantity_received integer, quantity_remaining integer,
  expiry_date date, received_date date, purchase_id integer,
  days_until_expiry integer, expiry_status varchar
)
LANGUAGE sql STABLE AS $$
  SELECT b.batch_id, b.batch_number, b.fruit_id, f.fruit_name, b.packaging_size,
         b.quantity_received, b.quantity_remaining, b.expiry_date, b.received_date, b.purchase_id,
         (b.expiry_date - CURRENT_DATE)::int,
         CASE
           WHEN b.expiry_date < CURRENT_DATE THEN 'EXPIRED'
           WHEN b.expiry_date <= CURRENT_DATE + 7 THEN 'EXPIRING_SOON'
           ELSE 'FRESH'
         END
    FROM public.stock_batches b
    JOIN public.fruits f ON f.fruit_id = b.fruit_id
   WHERE b.fruit_id = p_fruit_id AND b.packaging_size = p_packaging_size
   ORDER BY b.expiry_date ASC, b.batch_id ASC;
$$;

DROP FUNCTION IF EXISTS public.report_expiring_batches(integer);
CREATE FUNCTION public.report_expiring_batches(p_days integer DEFAULT 30)
RETURNS TABLE(
  batch_id integer, batch_number varchar, fruit_name varchar, packaging_size varchar,
  quantity_remaining integer, expiry_date date, days_until_expiry integer, expiry_status varchar
)
LANGUAGE sql STABLE AS $$
  SELECT b.batch_id, b.batch_number, f.fruit_name, b.packaging_size,
         b.quantity_remaining, b.expiry_date,
         (b.expiry_date - CURRENT_DATE)::int,
         CASE
           WHEN b.expiry_date < CURRENT_DATE THEN 'EXPIRED'
           WHEN b.expiry_date <= CURRENT_DATE + 7 THEN 'EXPIRING_SOON'
           ELSE 'FRESH'
         END
    FROM public.stock_batches b
    JOIN public.fruits f ON f.fruit_id = b.fruit_id
   WHERE b.quantity_remaining > 0
     AND b.expiry_date <= CURRENT_DATE + GREATEST(p_days, 1)
   ORDER BY b.expiry_date ASC, f.fruit_name ASC;
$$;

DROP FUNCTION IF EXISTS public.report_stock_levels();
CREATE FUNCTION public.report_stock_levels()
RETURNS TABLE(
  stock_id integer, fruit_id integer, fruit_name varchar, packaging_size varchar,
  available_quantity integer, saleable_quantity integer, expired_quantity integer,
  batch_count integer, expired_batch_count integer, earliest_expiry date,
  low_stock_threshold integer, is_low boolean
)
LANGUAGE sql STABLE AS $$
  SELECT s.stock_id, s.fruit_id, f.fruit_name, s.packaging_size, s.available_quantity,
         COALESCE(SUM(b.quantity_remaining) FILTER (WHERE b.expiry_date >= CURRENT_DATE), 0)::int,
         COALESCE(SUM(b.quantity_remaining) FILTER (WHERE b.expiry_date <  CURRENT_DATE), 0)::int,
         COUNT(b.batch_id)::int,
         COUNT(b.batch_id) FILTER (WHERE b.expiry_date < CURRENT_DATE)::int,
         MIN(b.expiry_date),
         s.low_stock_threshold,
         (COALESCE(SUM(b.quantity_remaining) FILTER (WHERE b.expiry_date >= CURRENT_DATE), 0) <= s.low_stock_threshold)
    FROM public.stock s
    JOIN public.fruits f ON f.fruit_id = s.fruit_id
    LEFT JOIN public.stock_batches b
           ON b.fruit_id = s.fruit_id AND b.packaging_size = s.packaging_size
   GROUP BY s.stock_id, s.fruit_id, f.fruit_name, s.packaging_size,
            s.available_quantity, s.low_stock_threshold
   ORDER BY f.fruit_name ASC,
            CASE s.packaging_size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END;
$$;

DROP FUNCTION IF EXISTS public.dashboard_metrics();
CREATE FUNCTION public.dashboard_metrics()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'total_revenue',       (SELECT COALESCE(SUM(total_amount), 0) FROM public.sales),
    'total_purchases',     (SELECT COALESCE(SUM(total_amount), 0) FROM public.purchases),
    'total_stock_boxes',   (SELECT COALESCE(SUM(available_quantity), 0) FROM public.stock),
    'low_stock_count',     (SELECT COUNT(*) FROM public.report_stock_levels() WHERE is_low),
    'total_outstanding',   (SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM public.sales),
    'supplier_count',      (SELECT COUNT(*) FROM public.suppliers),
    'vendor_count',        (SELECT COUNT(*) FROM public.vendors),
    'active_fruit_count',  (SELECT COUNT(*) FROM public.fruits WHERE status = 'ACTIVE'),
    'sale_count',          (SELECT COUNT(*) FROM public.sales),
    'purchase_count',      (SELECT COUNT(*) FROM public.purchases),
    'expired_batch_count', (SELECT COUNT(*) FROM public.stock_batches
                             WHERE expiry_date < CURRENT_DATE AND quantity_remaining > 0),
    'expiring_soon_count', (SELECT COUNT(*) FROM public.stock_batches
                             WHERE expiry_date >= CURRENT_DATE
                               AND expiry_date <= CURRENT_DATE + 7
                               AND quantity_remaining > 0)
  );
$$;
