import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, MapPin, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { listVendorBalances, listVendors } from '@/services/api';
import type { Vendor, VendorBalance } from '@/types/types';
import { errorMessage, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const MASERU: [number, number] = [-29.3151, 27.4869];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pinIcon = (mapped: boolean) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;border:2px solid #ffffff;background:${
      mapped ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'
    };box-shadow:0 0 0 2px rgba(0,0,0,0.28)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });

const VendorMap = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [balances, setBalances] = useState<VendorBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vendorData, balanceData] = await Promise.all([listVendors(), listVendorBalances()]);
      setVendors(vendorData);
      setBalances(balanceData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const balanceByVendor = useMemo(() => {
    const map = new Map<number, number>();
    balances.forEach((row) => map.set(row.vendor_id, row.outstanding_balance));
    return map;
  }, [balances]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const matchesTerm =
        !term ||
        vendor.vendor_name.toLowerCase().includes(term) ||
        vendor.location.toLowerCase().includes(term) ||
        vendor.phone.toLowerCase().includes(term);
      const outstanding = balanceByVendor.get(vendor.vendor_id) ?? 0;
      return matchesTerm && (!onlyOutstanding || outstanding > 0);
    });
  }, [vendors, search, onlyOutstanding, balanceByVendor]);

  const mapped = filtered.filter(
    (vendor) => vendor.latitude !== null && vendor.longitude !== null,
  );
  const unmapped = filtered.filter(
    (vendor) => vendor.latitude === null || vendor.longitude === null,
  );

  // Initialise the map once.
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;
    const map = L.map(mapContainer.current, {
      center: MASERU,
      zoom: 12,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Sync markers with the filtered vendor list.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    const points: L.LatLngExpression[] = [];
    mapped.forEach((vendor) => {
      if (vendor.latitude === null || vendor.longitude === null) return;
      const outstanding = balanceByVendor.get(vendor.vendor_id) ?? 0;
      const marker = L.marker([vendor.latitude, vendor.longitude], { icon: pinIcon(true) })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:180px;font-family:inherit">
             <strong style="display:block;font-size:13px">${escapeHtml(vendor.vendor_name)}</strong>
             <span style="display:block;font-size:12px;color:#4b5563">${escapeHtml(vendor.phone)}</span>
             <span style="display:block;font-size:12px;color:#4b5563">${escapeHtml(vendor.location)}</span>
             <span style="display:block;margin-top:6px;font-size:12px">
               Outstanding: <strong>${escapeHtml(formatCurrency(outstanding))}</strong>
             </span>
           </div>`,
        );
      markers.current.push(marker);
      points.push([vendor.latitude, vendor.longitude]);
    });

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView(MASERU, 12);
    }
  }, [mapped, balanceByVendor]);

  const focusVendor = (vendor: Vendor) => {
    const map = mapInstance.current;
    if (!map || vendor.latitude === null || vendor.longitude === null) return;
    map.setView([vendor.latitude, vendor.longitude], 15);
    const marker = markers.current.find((item) => {
      const position = item.getLatLng();
      return (
        Math.abs(position.lat - (vendor.latitude as number)) < 1e-6 &&
        Math.abs(position.lng - (vendor.longitude as number)) < 1e-6
      );
    });
    marker?.openPopup();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Logistics"
        title="Vendor location map"
        description="Track where every vendor trades so deliveries and supplier routes can be planned around real locations."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="paper-panel min-w-0 md:col-span-1">
          <div className="space-y-3 border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search vendor, phone or area"
                className="pl-8"
                aria-label="Search vendors"
              />
            </div>
            <Button
              variant={onlyOutstanding ? 'default' : 'outline'}
              size="sm"
              className="w-full"
              onClick={() => setOnlyOutstanding((current) => !current)}
            >
              Only vendors with a balance
            </Button>
            <p className="text-xs text-muted-foreground">
              {mapped.length} mapped · {unmapped.length} without coordinates
            </p>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            <div className="px-4 py-3">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No vendors match this search.
                </p>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((vendor) => {
                    const outstanding = balanceByVendor.get(vendor.vendor_id) ?? 0;
                    const hasLocation = vendor.latitude !== null && vendor.longitude !== null;
                    return (
                      <li key={vendor.vendor_id}>
                        <button
                          type="button"
                          onClick={() => focusVendor(vendor)}
                          disabled={!hasLocation}
                          className={cn(
                            'w-full border border-border px-3 py-2 text-left transition-colors',
                            hasLocation
                              ? 'hover:border-primary/60 hover:bg-muted/60'
                              : 'cursor-not-allowed opacity-70',
                          )}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {vendor.vendor_name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {vendor.location}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="ledger-num block text-xs font-semibold">
                                {formatCurrency(outstanding)}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {hasLocation ? 'Mapped' : 'No location'}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="paper-panel min-w-0 md:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold text-foreground">
                Maseru trading area
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select a vendor to centre the map on their location
              </p>
            </div>
            <span className="stamp shrink-0 gap-1">
              <MapPin className="h-3 w-3" />
              {mapped.length} pins
            </span>
          </div>
          <div className="p-3">
            <div
              ref={mapContainer}
              className="h-[420px] w-full border border-border"
              role="application"
              aria-label="Map of vendor locations"
            />
          </div>
        </section>
      </div>

      {!loading && unmapped.length > 0 ? (
        <section className="paper-panel mt-4 min-w-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              Vendors without a location
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add coordinates on the Vendors page so these vendors appear on the map
            </p>
          </div>
          <ul className="divide-y divide-border">
            {unmapped.map((vendor) => (
              <li
                key={vendor.vendor_id}
                className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{vendor.vendor_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vendor.phone} · {vendor.location}
                  </p>
                </div>
                <span className="stamp shrink-0 gap-1 border-destructive/60 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  Location missing
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && vendors.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No vendors registered"
          description="Register a vendor with coordinates to start tracking locations on the map."
        />
      ) : null}
    </div>
  );
};

export default VendorMap;
