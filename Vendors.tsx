import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Search, Store, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createVendor, deleteVendor, listVendors, updateVendor } from '@/services/api';
import type { Vendor } from '@/types/types';
import { errorMessage, formatDate, todayISO } from '@/lib/format';

interface VendorForm {
  vendor_name: string;
  phone: string;
  location: string;
  registration_date: string;
  latitude: string;
  longitude: string;
}

const emptyForm = (): VendorForm => ({
  vendor_name: '',
  phone: '',
  location: '',
  registration_date: todayISO(),
  latitude: '',
  longitude: '',
});

const Vendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    setError(null);
    try {
      setVendors(await listVendors(term));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = async () => {
    setSearching(true);
    await load(search);
    setSearching(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditing(vendor);
    setForm({
      vendor_name: vendor.vendor_name,
      phone: vendor.phone,
      location: vendor.location,
      registration_date: vendor.registration_date,
      latitude: vendor.latitude === null ? '' : String(vendor.latitude),
      longitude: vendor.longitude === null ? '' : String(vendor.longitude),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.vendor_name.trim()) return setFormError('Vendor name is required.');
    if (!form.phone.trim()) return setFormError('Phone number is required.');
    if (!form.location.trim()) return setFormError('Location is required.');
    if (!form.registration_date) return setFormError('Registration date is required.');

    const latitude = form.latitude.trim() === '' ? null : Number(form.latitude);
    const longitude = form.longitude.trim() === '' ? null : Number(form.longitude);
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
      return setFormError('Latitude must be a number between -90 and 90.');
    }
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      return setFormError('Longitude must be a number between -180 and 180.');
    }
    if ((latitude === null) !== (longitude === null)) {
      return setFormError('Enter both latitude and longitude, or leave both blank.');
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        vendor_name: form.vendor_name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        registration_date: form.registration_date,
        latitude,
        longitude,
      };
      if (editing) {
        await updateVendor(editing.vendor_id, payload);
        toast.success('Vendor updated.');
      } else {
        await createVendor(payload);
        toast.success('Vendor registered.');
      }
      setDialogOpen(false);
      await load(search);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteVendor(deleteTarget.vendor_id);
      toast.success('Vendor deleted.');
      setDeleteTarget(null);
      await load(search);
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Master data"
        title="Vendor management"
        description="Street vendors and small retailers across Lesotho who buy fruit boxes from the depot."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Register vendor
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-sm text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <section className="paper-panel min-w-0">
        <div className="flex flex-row items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-semibold text-foreground">
              Registered vendors
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {vendors.length} record{vendors.length === 1 ? '' : 's'}
              {search.trim() ? ` matching “${search.trim()}”` : ''}
            </p>
          </div>
          <form
            className="flex w-full max-w-72 shrink-0 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or phone"
                className="h-9 pl-8 text-sm"
                aria-label="Search vendors by name or phone"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-9 shrink-0" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </form>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Store}
            title={search.trim() ? 'No matching vendors' : 'No vendors registered'}
            description={
              search.trim()
                ? 'No vendor matches that name or phone number. Clear the search to see all records.'
                : 'Register the first street vendor to start recording sales.'
            }
            action={
              search.trim() ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    void load();
                  }}
                >
                  Clear search
                </Button>
              ) : (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Register vendor
                </Button>
              )
            }
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">ID</TableHead>
                  <TableHead className="whitespace-nowrap">Vendor name</TableHead>
                  <TableHead className="whitespace-nowrap">Phone number</TableHead>
                  <TableHead className="whitespace-nowrap">Location</TableHead>
                  <TableHead className="whitespace-nowrap">Registered</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.vendor_id}>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {vendor.vendor_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {vendor.vendor_name}
                    </TableCell>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {vendor.phone}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{vendor.location}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(vendor.registration_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(vendor)}
                          aria-label={`Edit ${vendor.vendor_name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget(vendor);
                            setDeleteError(null);
                          }}
                          aria-label={`Delete ${vendor.vendor_name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit vendor' : 'Register vendor'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the vendor contact and trading location.'
                : 'Add a street vendor or small retailer that buys from the depot.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vendor_name">Vendor name</Label>
              <Input
                id="vendor_name"
                value={form.vendor_name}
                onChange={(event) => setForm({ ...form, vendor_name: event.target.value })}
                placeholder="Mamello Fruit Stall"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vendor_phone">Phone number</Label>
                <Input
                  id="vendor_phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="+266 5812 4471"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registration_date">Registration date</Label>
                <Input
                  id="registration_date"
                  type="date"
                  value={form.registration_date}
                  onChange={(event) => setForm({ ...form, registration_date: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Maseru Market, Maseru"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.000001"
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                  placeholder="-29.315100"
                  className="ledger-num"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.000001"
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                  placeholder="27.486900"
                  className="ledger-num"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Coordinates place the vendor on the location map. Leave both blank if the location is
              not yet known — the vendor will be listed as unmapped.
            </p>
            {formError ? (
              <p className="break-words border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Register vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.vendor_name} will be permanently removed. Vendors with linked sales records cannot be deleted.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="break-words border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete vendor'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Vendors;
