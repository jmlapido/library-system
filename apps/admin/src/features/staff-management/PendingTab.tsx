import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';

interface PendingStaff {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

const col = createColumnHelper<PendingStaff>();

/** Tab displaying staff accounts awaiting admin approval, with approve/reject actions. */
export function PendingTab() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingStaff | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['staff', 'pending'],
    queryFn: () => api.get<PendingStaff[]>('/admin/staff/pending'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/staff/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', 'pending'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/staff/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', 'pending'] });
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const columns = [
    col.accessor('fullName', { header: 'Name' }),
    col.accessor('email', { header: 'Email' }),
    col.accessor('role', {
      header: 'Role',
      cell: (info) => (
        <Badge variant="secondary" className="capitalize">
          {info.getValue().replace('_', ' ')}
        </Badge>
      ),
    }),
    col.accessor('createdAt', {
      header: 'Registered',
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => approveMutation.mutate(row.original.id)}
            disabled={approveMutation.isPending}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRejectTarget(row.original)}
          >
            Reject
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: pending,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      {pending.length === 0 ? (
        <p className="p-4 text-muted-foreground">No pending registrations</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-2 text-left font-medium">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.fullName}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() =>
                rejectTarget &&
                rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })
              }
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
