import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type FineStatus = 'outstanding' | 'paid' | 'waived' | 'all';

interface FineRecord {
  checkoutId: string;
  userId: string;
  userName: string;
  bookTitle: string;
  dueDate: string;
  returnDate: string | null;
  fineAmount: number;
  finePaid: boolean;
  fineWaived: boolean;
  daysOverdue: number;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ paid, waived }: { paid: boolean; waived: boolean }) {
  if (waived) return <Badge variant="secondary">Waived</Badge>;
  if (paid) return <Badge variant="default">Paid</Badge>;
  return <Badge variant="destructive">Outstanding</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * FinesPage — list and manage student fines. Librarian / admin only.
 */
export function FinesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<FineStatus>('outstanding');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: fines = [], isLoading } = useQuery<FineRecord[]>({
    queryKey: ['fines', status],
    queryFn: () => api.get<FineRecord[]>(`/fines?status=${status}`),
  });

  const waiveMutation = useMutation({
    mutationFn: (checkoutId: string) =>
      api.post(`/fines/${checkoutId}/waive`, {}),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['fines'] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Waive failed');
    },
  });

  const paidMutation = useMutation({
    mutationFn: (checkoutId: string) =>
      api.post(`/fines/${checkoutId}/mark-paid`, {}),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['fines'] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Mark paid failed');
    },
  });

  const isPending = waiveMutation.isPending || paidMutation.isPending;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fines</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as FineStatus)}
            className="rounded-md border px-2 py-1 text-sm"
          >
            <option value="outstanding">Outstanding</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fine Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton />
          ) : fines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No fines found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Book</th>
                    <th className="pb-2 pr-4 font-medium">Due Date</th>
                    <th className="pb-2 pr-4 font-medium">Days Overdue</th>
                    <th className="pb-2 pr-4 font-medium">Fine (₱)</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((fine) => (
                    <tr key={fine.checkoutId} className="border-b last:border-0">
                      <td className="py-2 pr-4">{fine.userName}</td>
                      <td className="py-2 pr-4">{fine.bookTitle}</td>
                      <td className="py-2 pr-4">
                        {new Date(fine.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-destructive">
                        {fine.daysOverdue}
                      </td>
                      <td className="py-2 pr-4 font-semibold">
                        {fine.fineAmount.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge paid={fine.finePaid} waived={fine.fineWaived} />
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {!fine.fineWaived && !fine.finePaid && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => waiveMutation.mutate(fine.checkoutId)}
                              >
                                Waive
                              </Button>
                              <Button
                                size="sm"
                                disabled={isPending}
                                onClick={() => paidMutation.mutate(fine.checkoutId)}
                              >
                                Mark Paid
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
