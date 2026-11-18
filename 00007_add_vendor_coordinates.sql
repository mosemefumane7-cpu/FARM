-- Vendor geographic coordinates for map tracking
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS latitude  numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_latitude_range'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_latitude_range
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_longitude_range'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_longitude_range
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendors_coordinates
  ON public.vendors (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Seed Maseru-area coordinates for existing vendors, leaving the two most
-- recent vendors unmapped so the "location missing" workflow stays visible.
UPDATE public.vendors v
   SET latitude  = ROUND((-29.3100 - ((v.vendor_id % 5) * 0.0062))::numeric, 7),
       longitude = ROUND(( 27.4800 + ((v.vendor_id % 7) * 0.0071))::numeric, 7),
       location_updated_at = now()
 WHERE v.latitude IS NULL
   AND v.vendor_id NOT IN (
     SELECT vendor_id FROM public.vendors ORDER BY vendor_id DESC LIMIT 2
   );
