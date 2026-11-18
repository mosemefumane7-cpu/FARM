import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Apple, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatusStamp from '@/components/common/StatusStamp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createFruit,
  deleteFruit,
  listFruitPrices,
  listFruits,
  updateFruit,
  upsertFruitPrice,
} from '@/services/api';
import { PACKAGING_SIZES, type Fruit, type FruitPrice, type FruitStatus, type PackagingSize } from '@/types/types';
import { errorMessage, formatCurrency, packagingLabel } from '@/lib/format';

interface FruitForm {
  fruit_name: string;
  description: string;
  status: FruitStatus;
}

const EMPTY_FORM: FruitForm = { fruit_name: '', description: '', status: 'ACTIVE' };

const emptyPrices = (): Record<PackagingSize, string> => ({ SMALL: '', MEDIUM: '', LARGE: '' });

const Fruits = () => {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [prices, setPrices] = useState<FruitPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fruit | null>(null);
  const [form, setForm] = useState<FruitForm>(EMPTY_FORM);
  const [priceForm, setPriceForm] = useState<Record<PackagingSize, string>>(emptyPrices());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Fruit | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fruitData, priceData] = await Promise.all([listFruits(), listFruitPrices()]);
      setFruits(fruitData);
      setPrices(priceData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    prices.forEach((price) => map.set(`${price.fruit_id}:${price.packaging_size}`, price.selling_price));
    return map;
  }, [prices]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return fruits;
    return fruits.filter((fruit) =>
      `${fruit.fruit_name} ${fruit.description ?? ''}`.toLowerCase().includes(term),
    );
  }, [fruits, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPriceForm(emptyPrices());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (fruit: Fruit) => {
    setEditing(fruit);
    setForm({
      fruit_name: fruit.fruit_name,
      description: fruit.description ?? '',
      status: fruit.status,
    });
    setPriceForm({
      SMALL: String(priceMap.get(`${fruit.fruit_id}:SMALL`) ?? ''),
      MEDIUM: String(priceMap.get(`${fruit.fruit_id}:MEDIUM`) ?? ''),
      LARGE: String(priceMap.get(`${fruit.fruit_id}:LARGE`) ?? ''),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.fruit_name.trim()) return setFormError('Fruit name is required.');

    const parsedPrices: Record<PackagingSize, number> = { SMALL: 0, MEDIUM: 0, LARGE: 0 };
    for (const size of PACKAGING_SIZES) {
      const raw = priceForm[size].trim();
      const value = Number(raw);
      if (!raw || Number.isNaN(value) || value <= 0) {
        return setFormError(`Enter a selling price greater than zero for ${packagingLabel(size)} packaging.`);
      }
      parsedPrices[size] = value;
    }
    if (new Set(Object.values(parsedPrices)).size !== 3) {
      return setFormError('Each packaging size must have a different selling price.');
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        fruit_name: form.fruit_name.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        status: form.status,
      };
      const fruitId = editing ? editing.fruit_id : await createFruit(payload);
      if (editing) await updateFruit(editing.fruit_id, payload);

      for (const size of PACKAGING_SIZES) {
        await upsertFruitPrice(fruitId, size, parsedPrices[size]);
      }

      toast.success(editing ? 'Fruit updated.' : 'Fruit registered with stock records for all sizes.');
      setDialogOpen(false);
      await load();
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
      await deleteFruit(deleteTarget.fruit_id);
      toast.success('Fruit deleted.');
      setDeleteTarget(null);
      await load();
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
        title="Fruit catalogue"
        description="Fruit types traded by the depot, with a distinct selling price for small, medium and large packaging."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Register fruit
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
              Fruit types
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filtered.length} of {fruits.length} records
            </p>
          </div>
          <div className="relative w-full max-w-56 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search fruits"
              className="h-9 pl-8 text-sm"
              aria-label="Search fruits"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Apple}
            title={fruits.length === 0 ? 'No fruits registered' : 'No matching fruits'}
            description={
              fruits.length === 0
                ? 'Register apples, bananas, oranges, mangoes or grapes to begin trading.'
                : 'Try a different fruit name.'
            }
            action={
              fruits.length === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Register fruit
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="[&>div]:max-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">ID</TableHead>
                  <TableHead className="whitespace-nowrap">Fruit</TableHead>
                  <TableHead className="whitespace-nowrap">Description</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Small</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Medium</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Large</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((fruit) => (
                  <TableRow key={fruit.fruit_id}>
                    <TableCell className="ledger-num whitespace-nowrap text-muted-foreground">
                      {fruit.fruit_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{fruit.fruit_name}</TableCell>
                    <TableCell className="max-w-72 truncate whitespace-nowrap text-muted-foreground">
                      {fruit.description || '—'}
                    </TableCell>
                    {PACKAGING_SIZES.map((size) => (
                      <TableCell
                        key={size}
                        className="ledger-num whitespace-nowrap text-right text-muted-foreground"
                      >
                        {priceMap.has(`${fruit.fruit_id}:${size}`)
                          ? formatCurrency(priceMap.get(`${fruit.fruit_id}:${size}`))
                          : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="whitespace-nowrap">
                      <StatusStamp
                        label={fruit.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        tone={fruit.status === 'ACTIVE' ? 'primary' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(fruit)}
                          aria-label={`Edit ${fruit.fruit_name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget(fruit);
                            setDeleteError(null);
                          }}
                          aria-label={`Delete ${fruit.fruit_name}`}
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
            <DialogTitle>{editing ? 'Edit fruit' : 'Register fruit'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the fruit details and its selling prices per packaging size.'
                : 'A stock record is created automatically for small, medium and large packaging.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fruit_name">Fruit name</Label>
              <Input
                id="fruit_name"
                value={form.fruit_name}
                onChange={(event) => setForm({ ...form, fruit_name: event.target.value })}
                placeholder="Apples"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Crisp red apples sourced from Western Cape orchards."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as FruitStatus })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Selling price per box
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Each packaging size must carry a different price.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {PACKAGING_SIZES.map((size) => (
                  <div key={size} className="space-y-1.5">
                    <Label htmlFor={`price-${size}`}>{packagingLabel(size)}</Label>
                    <Input
                      id={`price-${size}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={priceForm[size]}
                      onChange={(event) =>
                        setPriceForm({ ...priceForm, [size]: event.target.value })
                      }
                      placeholder="0.00"
                      className="ledger-num"
                    />
                  </div>
                ))}
              </div>
            </div>

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
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Register fruit'}
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
            <AlertDialogTitle>Delete fruit</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.fruit_name} and its stock records will be removed. Fruits with purchase or sales history cannot be deleted.`
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
              {deleting ? 'Deleting…' : 'Delete fruit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Fruits;
