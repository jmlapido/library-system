import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchoolYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const YearSchema = z.object({
  name: z.string().min(1, 'Name required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
});
type YearForm = z.infer<typeof YearSchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function YearRow({
  year,
  onActivate,
  onEdit,
  onDelete,
}: {
  year: SchoolYear;
  onActivate: (id: string) => void;
  onEdit: (year: SchoolYear) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <div>
          <p className="font-medium text-sm">{year.name}</p>
          <p className="text-xs text-muted-foreground">
            {year.startDate} → {year.endDate}
          </p>
        </div>
        {year.isActive && <Badge variant="default">Active</Badge>}
      </div>
      <div className="flex gap-2">
        {!year.isActive && (
          <Button size="sm" variant="outline" onClick={() => onActivate(year.id)}>
            Set Active
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onEdit(year)}>
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(year.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function YearFormDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: SchoolYear | null;
  onClose: () => void;
  onSave: (data: YearForm) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<YearForm>({
    resolver: zodResolver(YearSchema),
    defaultValues: initial
      ? { name: initial.name, startDate: initial.startDate, endDate: initial.endDate }
      : {},
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit School Year' : 'Add School Year'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="sy-name">Name</Label>
            <Input id="sy-name" placeholder="e.g. 2024–2025" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sy-start">Start Date</Label>
              <Input id="sy-start" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sy-end">End Date</Label>
              <Input id="sy-end" type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{initial ? 'Save Changes' : 'Create Year'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * School year management admin page — create, activate, edit, and delete
 * academic years.
 */
export function SchoolYearsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolYear | null>(null);

  const { data, isLoading, error } = useQuery<SchoolYear[]>({
    queryKey: ['school-years'],
    queryFn: () => api.get<SchoolYear[]>('/school-years'),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/school-years/${id}/activate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-years'] }),
  });

  const create = useMutation({
    mutationFn: (body: YearForm) => api.post<SchoolYear>('/school-years', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school-years'] }); setDialogOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: YearForm & { id: string }) =>
      api.patch<SchoolYear>(`/school-years/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['school-years'] }); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/school-years/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-years'] }),
  });

  function handleSave(form: YearForm) {
    if (editing) {
      update.mutate({ id: editing.id, ...form });
    } else {
      create.mutate(form);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">School Years</h1>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ Add Year</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Academic Years</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to load school years.</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No school years yet. Add one to get started.</p>
          ) : (
            data.map((year) => (
              <YearRow
                key={year.id}
                year={year}
                onActivate={(id) => activate.mutate(id)}
                onEdit={(y) => { setEditing(y); setDialogOpen(true); }}
                onDelete={(id) => remove.mutate(id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <YearFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
