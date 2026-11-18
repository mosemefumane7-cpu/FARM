-- ============================================================
-- Part D: Business logic, transactions and reporting queries
-- ============================================================

-- ------------------------------------------------------------
-- Record a purchase (multi-item, atomic)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_supplier_id   integer,
  p_purchase_date date,
  p_items         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase_id integer;
  v_total       numeric(12,2) := 0;
  v_item        jsonb;
  v_fruit_id    integer;
  v_qty         integer;
  v_cost        numeric(10,2);
  v_size        text;
  v_lines       integer := 0;
BEGIN
  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id = p_supplier_id) THEN
    RAISE EXCEPTION 'Supplier % does not exist.', p_supplier_id USING ERRCODE = 'P0002';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Please add at least one fruit line item.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO purchases (supplier_id, purchase_date, total_amount)
  VALUES (p_supplier_id, COALESCE(p_purchase_date, CURRENT_DATE), 0)
  RETURNING purchase_id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_fruit_id := (v_item->>'fruit_id')::integer;
    v_qty      := (v_item->>'quantity')::integer;
    v_cost     := (v_item->>'unit_cost')::numeric;
    v_size     := upper(COALESCE(v_item->>'packaging_size', ''));

    IF v_fruit_id IS NULL OR NOT EXISTS (SELECT 1 FROM fruits WHERE fruit_id = v_fruit_id) THEN
      RAISE EXCEPTION 'Fruit % does not exist.', COALESCE(v_fruit_id::text, '(missing)') USING ERRCODE = 'P0002';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be a positive whole number.' USING ERRCODE = '22023';
    END IF;
    IF v_cost IS NULL OR v_cost <= 0 THEN
      RAISE EXCEPTION 'Unit cost must be greater than zero.' USING ERRCODE = '22023';
    END IF;
    IF v_size NOT IN ('SMALL','MEDIUM','LARGE') THEN
      RAISE EXCEPTION 'Packaging size must be SMALL, MEDIUM or LARGE.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
    VALUES (v_purchase_id, v_fruit_id, v_qty, v_cost, v_size);

    INSERT INTO stock (fruit_id, packaging_size, available_quantity)
    VALUES (v_fruit_id, v_size, v_qty)
    ON CONFLICT (fruit_id, packaging_size)
    DO UPDATE SET available_quantity = stock.available_quantity + EXCLUDED.available_quantity,
                  updated_at = now();

    v_total := v_total + (v_qty * v_cost);
    v_lines := v_lines + 1;
  END LOOP;

  UPDATE purchases SET total_amount = v_total WHERE purchase_id = v_purchase_id;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'total_amount', v_total, 'line_count', v_lines);
END;
$$;

-- ------------------------------------------------------------
-- Record a sale (multi-item, atomic, stock-checked)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_sale(
  p_vendor_id      integer,
  p_sale_date      date,
  p_items          jsonb,
  p_payment_method text DEFAULT 'CREDIT'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id    integer;
  v_total      numeric(12,2) := 0;
  v_item       jsonb;
  v_fruit_id   integer;
  v_qty        integer;
  v_price      numeric(10,2);
  v_size       text;
  v_method     text := upper(COALESCE(p_payment_method, 'CREDIT'));
  v_status     text;
  v_paid       numeric(12,2);
  v_req        jsonb := '{}'::jsonb;
  v_key        text;
  v_need       integer;
  v_avail      integer;
  v_fruit_name text;
  v_lines      integer := 0;
BEGIN
  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_id = p_vendor_id) THEN
    RAISE EXCEPTION 'Vendor % does not exist.', p_vendor_id USING ERRCODE = 'P0002';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Please add at least one fruit line item.' USING ERRCODE = '22023';
  END IF;
  IF v_method NOT IN ('CASH','MOBILE_MONEY','CREDIT') THEN
    RAISE EXCEPTION 'Payment method must be CASH, MOBILE_MONEY or CREDIT.' USING ERRCODE = '22023';
  END IF;

  -- PASS 1: validate every line and accumulate requested quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_fruit_id := (v_item->>'fruit_id')::integer;
    v_qty      := (v_item->>'quantity')::integer;
    v_price    := (v_item->>'unit_price')::numeric;
    v_size     := upper(COALESCE(v_item->>'packaging_size', ''));

    IF v_fruit_id IS NULL OR NOT EXISTS (SELECT 1 FROM fruits WHERE fruit_id = v_fruit_id) THEN
      RAISE EXCEPTION 'Fruit % does not exist.', COALESCE(v_fruit_id::text, '(missing)') USING ERRCODE = 'P0002';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be a positive whole number.' USING ERRCODE = '22023';
    END IF;
    IF v_price IS NULL OR v_price <= 0 THEN
      RAISE EXCEPTION 'Unit selling price must be greater than zero.' USING ERRCODE = '22023';
    END IF;
    IF v_size NOT IN ('SMALL','MEDIUM','LARGE') THEN
      RAISE EXCEPTION 'Packaging size must be SMALL, MEDIUM or LARGE.' USING ERRCODE = '22023';
    END IF;

    v_key  := v_fruit_id::text || ':' || v_size;
    v_need := COALESCE((v_req->>v_key)::integer, 0) + v_qty;
    v_req  := jsonb_set(v_req, ARRAY[v_key], to_jsonb(v_need));

    v_total := v_total + (v_qty * v_price);
    v_lines := v_lines + 1;
  END LOOP;

  -- PASS 2: stock sufficiency check for the aggregated request
  FOR v_key IN SELECT jsonb_object_keys(v_req)
  LOOP
    v_fruit_id := split_part(v_key, ':', 1)::integer;
    v_size     := split_part(v_key, ':', 2);
    v_need     := (v_req->>v_key)::integer;

    SELECT available_quantity INTO v_avail
    FROM stock WHERE fruit_id = v_fruit_id AND packaging_size = v_size;

    IF v_avail IS NULL THEN
      v_avail := 0;
    END IF;

    IF v_avail < v_need THEN
      SELECT fruit_name INTO v_fruit_name FROM fruits WHERE fruit_id = v_fruit_id;
      RAISE EXCEPTION
        'Insufficient stock for % - % packaging. Available: % boxes, Requested: % boxes. Transaction cancelled.',
        v_fruit_name, initcap(v_size), v_avail, v_need
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- PASS 3: write the sale, its lines and the stock movements
  v_status := CASE WHEN v_method = 'CREDIT' THEN 'UNPAID' ELSE 'PAID' END;
  v_paid   := CASE WHEN v_method = 'CREDIT' THEN 0 ELSE v_total END;

  INSERT INTO sales (vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid)
  VALUES (p_vendor_id, COALESCE(p_sale_date, CURRENT_DATE), v_status, v_method, v_total, v_paid)
  RETURNING sale_id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_fruit_id := (v_item->>'fruit_id')::integer;
    v_qty      := (v_item->>'quantity')::integer;
    v_price    := (v_item->>'unit_price')::numeric;
    v_size     := upper(v_item->>'packaging_size');

    INSERT INTO sale_details (sale_id, fruit_id, packaging_size, quantity, unit_price)
    VALUES (v_sale_id, v_fruit_id, v_size, v_qty, v_price);

    UPDATE stock
    SET available_quantity = available_quantity - v_qty,
        updated_at = now()
    WHERE fruit_id = v_fruit_id AND packaging_size = v_size;
  END LOOP;

  IF v_method <> 'CREDIT' THEN
    INSERT INTO payments (sale_id, vendor_id, amount, payment_method, payment_date, note)
    VALUES (v_sale_id, p_vendor_id, v_total, v_method, COALESCE(p_sale_date, CURRENT_DATE), 'Settled at point of sale');
  END IF;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'total_amount', v_total,
    'payment_status', v_status,
    'line_count', v_lines
  );
END;
$$;

-- ------------------------------------------------------------
-- Record a vendor payment against a sale
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payment(
  p_sale_id      integer,
  p_amount       numeric,
  p_method       text,
  p_payment_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale        sales%ROWTYPE;
  v_outstanding numeric(12,2);
  v_method      text := upper(COALESCE(p_method, ''));
  v_new_paid    numeric(12,2);
  v_new_status  text;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE sale_id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale % does not exist.', p_sale_id USING ERRCODE = 'P0002';
  END IF;

  v_outstanding := v_sale.total_amount - v_sale.amount_paid;

  IF v_outstanding <= 0 THEN
    RAISE EXCEPTION 'This sale is already fully paid.' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.' USING ERRCODE = '22023';
  END IF;
  IF p_amount > v_outstanding THEN
    RAISE EXCEPTION 'Payment amount cannot exceed the outstanding balance of %.', v_outstanding USING ERRCODE = '22023';
  END IF;
  IF v_method NOT IN ('CASH','MOBILE_MONEY') THEN
    RAISE EXCEPTION 'Payment method must be CASH or MOBILE_MONEY.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO payments (sale_id, vendor_id, amount, payment_method, payment_date)
  VALUES (p_sale_id, v_sale.vendor_id, p_amount, v_method, COALESCE(p_payment_date, CURRENT_DATE));

  v_new_paid   := v_sale.amount_paid + p_amount;
  v_new_status := CASE WHEN v_new_paid >= v_sale.total_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END;

  UPDATE sales
  SET amount_paid = v_new_paid, payment_status = v_new_status
  WHERE sale_id = p_sale_id;

  RETURN jsonb_build_object(
    'sale_id', p_sale_id,
    'amount_paid', v_new_paid,
    'outstanding', v_sale.total_amount - v_new_paid,
    'payment_status', v_new_status
  );
END;
$$;

-- ------------------------------------------------------------
-- Deletion guards (referential integrity business rules)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_supplier_checked(p_supplier_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_id = p_supplier_id) THEN
    RAISE EXCEPTION 'Supplier % does not exist.', p_supplier_id USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM purchases WHERE supplier_id = p_supplier_id) THEN
    RAISE EXCEPTION 'Cannot delete supplier: linked purchase records exist.' USING ERRCODE = '23503';
  END IF;
  DELETE FROM suppliers WHERE supplier_id = p_supplier_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_vendor_checked(p_vendor_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_id = p_vendor_id) THEN
    RAISE EXCEPTION 'Vendor % does not exist.', p_vendor_id USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM sales WHERE vendor_id = p_vendor_id) THEN
    RAISE EXCEPTION 'Cannot delete vendor: linked sales records exist.' USING ERRCODE = '23503';
  END IF;
  DELETE FROM vendors WHERE vendor_id = p_vendor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_fruit_checked(p_fruit_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fruits WHERE fruit_id = p_fruit_id) THEN
    RAISE EXCEPTION 'Fruit % does not exist.', p_fruit_id USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM purchase_details WHERE fruit_id = p_fruit_id)
     OR EXISTS (SELECT 1 FROM sale_details WHERE fruit_id = p_fruit_id) THEN
    RAISE EXCEPTION 'Cannot delete fruit: linked purchase or sales records exist.' USING ERRCODE = '23503';
  END IF;
  DELETE FROM fruits WHERE fruit_id = p_fruit_id;
END;
$$;

-- ------------------------------------------------------------
-- Reporting queries
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_top_fruits(p_limit integer DEFAULT 5)
RETURNS TABLE (fruit_id integer, fruit_name varchar, total_boxes bigint, total_revenue numeric, order_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.fruit_id,
         f.fruit_name,
         COALESCE(SUM(sd.quantity), 0)::bigint                        AS total_boxes,
         COALESCE(SUM(sd.quantity * sd.unit_price), 0)::numeric(12,2) AS total_revenue,
         COUNT(DISTINCT sd.sale_id)::bigint                           AS order_count
  FROM sale_details sd
  JOIN fruits f ON f.fruit_id = sd.fruit_id
  GROUP BY f.fruit_id, f.fruit_name
  ORDER BY total_boxes DESC, total_revenue DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.report_revenue(p_start date, p_end date)
RETURNS TABLE (report_date date, order_count bigint, boxes_sold bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.sale_date                                        AS report_date,
         COUNT(DISTINCT s.sale_id)::bigint                   AS order_count,
         COALESCE(SUM(sd.quantity), 0)::bigint               AS boxes_sold,
         COALESCE(SUM(sd.quantity * sd.unit_price), 0)::numeric(12,2) AS revenue
  FROM sales s
  LEFT JOIN sale_details sd ON sd.sale_id = s.sale_id
  WHERE s.sale_date BETWEEN p_start AND p_end
  GROUP BY s.sale_date
  ORDER BY s.sale_date;
$$;

CREATE OR REPLACE FUNCTION public.report_top_vendors()
RETURNS TABLE (vendor_id integer, vendor_name varchar, phone varchar, location varchar,
               total_boxes bigint, order_count bigint, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.vendor_id,
         v.vendor_name,
         v.phone,
         v.location,
         COALESCE(SUM(sd.quantity), 0)::bigint                        AS total_boxes,
         COUNT(DISTINCT s.sale_id)::bigint                            AS order_count,
         COALESCE(SUM(sd.quantity * sd.unit_price), 0)::numeric(12,2) AS total_value
  FROM vendors v
  LEFT JOIN sales s        ON s.vendor_id = v.vendor_id
  LEFT JOIN sale_details sd ON sd.sale_id = s.sale_id
  GROUP BY v.vendor_id, v.vendor_name, v.phone, v.location
  ORDER BY total_boxes DESC, total_value DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_stock_levels()
RETURNS TABLE (stock_id integer, fruit_id integer, fruit_name varchar, packaging_size varchar,
               available_quantity integer, low_stock_threshold integer, is_low boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT st.stock_id,
         f.fruit_id,
         f.fruit_name,
         st.packaging_size,
         st.available_quantity,
         st.low_stock_threshold,
         (st.available_quantity <= st.low_stock_threshold) AS is_low
  FROM stock st
  JOIN fruits f ON f.fruit_id = st.fruit_id
  ORDER BY f.fruit_name,
           CASE st.packaging_size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_balances()
RETURNS TABLE (vendor_id integer, vendor_name varchar, phone varchar, location varchar,
               total_billed numeric, total_paid numeric, outstanding_balance numeric, sale_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.vendor_id,
         v.vendor_name,
         v.phone,
         v.location,
         COALESCE(SUM(s.total_amount), 0)::numeric(12,2)                    AS total_billed,
         COALESCE(SUM(s.amount_paid), 0)::numeric(12,2)                     AS total_paid,
         COALESCE(SUM(s.total_amount - s.amount_paid), 0)::numeric(12,2)    AS outstanding_balance,
         COUNT(s.sale_id)::bigint                                           AS sale_count
  FROM vendors v
  LEFT JOIN sales s ON s.vendor_id = v.vendor_id
  GROUP BY v.vendor_id, v.vendor_name, v.phone, v.location
  ORDER BY outstanding_balance DESC, v.vendor_name;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_metrics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_revenue',      (SELECT COALESCE(SUM(total_amount), 0) FROM sales),
    'total_purchases',    (SELECT COALESCE(SUM(total_amount), 0) FROM purchases),
    'total_stock_boxes',  (SELECT COALESCE(SUM(available_quantity), 0) FROM stock),
    'low_stock_count',    (SELECT COUNT(*) FROM stock WHERE available_quantity <= low_stock_threshold),
    'total_outstanding',  (SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM sales),
    'supplier_count',     (SELECT COUNT(*) FROM suppliers),
    'vendor_count',       (SELECT COUNT(*) FROM vendors),
    'active_fruit_count', (SELECT COUNT(*) FROM fruits WHERE status = 'ACTIVE'),
    'sale_count',         (SELECT COUNT(*) FROM sales),
    'purchase_count',     (SELECT COUNT(*) FROM purchases)
  );
$$;

GRANT EXECUTE ON FUNCTION public.record_purchase(integer, date, jsonb)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sale(integer, date, jsonb, text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(integer, numeric, text, date)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplier_checked(integer)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_vendor_checked(integer)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_fruit_checked(integer)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_top_fruits(integer)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_revenue(date, date)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_top_vendors()                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_stock_levels()                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_balances()                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics()                            TO anon, authenticated;