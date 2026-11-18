DO $$
DECLARE
  v_batch_before integer;
  v_batch_after  integer;
  v_stock_before integer;
  v_stock_after  integer;
  v_sales_before integer;
  v_sales_after  integer;
BEGIN
  SELECT COUNT(*) INTO v_sales_before FROM public.sales;
  SELECT available_quantity INTO v_stock_before FROM public.stock WHERE fruit_id = 1 AND packaging_size = 'LARGE';
  SELECT quantity_remaining INTO v_batch_before
    FROM public.stock_batches
   WHERE fruit_id = 1 AND packaging_size = 'LARGE'
   ORDER BY expiry_date ASC, batch_id ASC LIMIT 1;

  PERFORM public.record_sale(1, CURRENT_DATE,
    '[{"fruit_id":1,"packaging_size":"LARGE","quantity":3,"unit_price":150}]'::jsonb, 'CASH');

  SELECT COUNT(*) INTO v_sales_after FROM public.sales;
  SELECT available_quantity INTO v_stock_after FROM public.stock WHERE fruit_id = 1 AND packaging_size = 'LARGE';
  SELECT quantity_remaining INTO v_batch_after
    FROM public.stock_batches
   WHERE fruit_id = 1 AND packaging_size = 'LARGE'
   ORDER BY expiry_date ASC, batch_id ASC LIMIT 1;

  RAISE EXCEPTION 'FEFO_TEST sales %->% | stock %->% | earliest batch %->%',
    v_sales_before, v_sales_after, v_stock_before, v_stock_after, v_batch_before, v_batch_after;
END $$;