DO $$
DECLARE
  v_stock_before integer;
  v_stock_after  integer;
  v_batch_qty    integer;
  v_batch_expiry date;
BEGIN
  SELECT available_quantity INTO v_stock_before FROM public.stock WHERE fruit_id = 1 AND packaging_size = 'LARGE';

  PERFORM public.record_purchase(1, CURRENT_DATE,
    '[{"fruit_id":1,"packaging_size":"LARGE","quantity":5,"unit_cost":62,"batch_number":"BATCH-TEST-001","expiry_date":"2026-12-31"}]'::jsonb);

  SELECT available_quantity INTO v_stock_after FROM public.stock WHERE fruit_id = 1 AND packaging_size = 'LARGE';
  SELECT quantity_remaining, expiry_date INTO v_batch_qty, v_batch_expiry
    FROM public.stock_batches WHERE batch_number = 'BATCH-TEST-001';

  RAISE EXCEPTION 'PURCHASE_TEST stock %->% | batch qty % | expiry %',
    v_stock_before, v_stock_after, v_batch_qty, v_batch_expiry;
END $$;