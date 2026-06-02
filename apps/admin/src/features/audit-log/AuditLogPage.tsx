import { useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'book.created', label: 'book.created' },
  { value: 'book.updated', label: 'book.updated' },
  { value: 'book.deleted', label: 'book.deleted' },
  { value: 'checkout.created', label: 'checkout.created' },
  { value: 'checkout.returned', label: 'checkout.returned' },
  { value: 'user.approved', label: 'user.approved' },
  { value: 'user.rejected', label: 'user.rejected' },
  { value: 'settings.updated', label: 'settings.updated' },
] as const;

const PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const AuditEntrySchema = z.object({
  id: z.string(),
  actorName: z.string(),
  actorRole: z.string(),
  action: z.string(),
  recordId: z.string(),
  recordDescription: z.string(),
  ipAddress: z.string(),
  createdAt: z.string(),
});

const AuditLogResponseSchema = z.object({
  entries: z.array(AuditEntrySchema),
  total: z.number(),
  page: z.number(),
  totalPages: z.number(),
});

type AuditEntry = z.infer<typeof AuditEntrySchema>;
type AuditLogData = z.infer<typeof AuditLogResponseSchema>;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

interface AuditFilters {
  action: string;
  from: string;
  to: string;
  page: number;
}

/** Fetches a page of audit log entries from the server. */
async function fetchAuditLog(filters: AuditFilters): Promise<AuditLogData> {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(PAGE_LIMIT) });
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const data = await api.get<AuditLogData>(`/analytics/audit-log?${params}`);
  return AuditLogResponseSchema.parse(data);
}

/** Triggers CSV export by redirecting to the export endpoint. */
function exportCsv(filters: Omit<AuditFilters, 'page'>): void {
  const params = new URLSearchParams();
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  window.location.href = `${API_BASE}/api/v1/analytics/audit-log/export?${params}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Role chip shown next to actor name. */
function RoleChip({ role }: { role: string }) {
  return (
    <Badge variant="secondary" className="ml-1.5 text-xs capitalize">
      {role.replace(/_/g, ' ')}
    </Badge>
  );
}

/** Monospaced action badge. */
function ActionBadge({ action }: { action: string }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{action}</code>
  );
}

/** Skeleton rows shown while loading. */
function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Timestamp',
    cell: ({ getValue }) => {
      const iso = getValue<string>();
      return (
        <span className="text-sm tabular-nums text-muted-foreground">
          {new Date(iso).toLocaleString()}
        </span>
      );
    },
  },
  {
    id: 'actor',
    header: 'Actor',
    cell: ({ row }) => (
      <span className="flex items-center whitespace-nowrap">
        <span className="text-sm font-medium">{row.original.actorName}</span>
        <RoleChip role={row.original.actorRole} />
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ getValue }) => <ActionBadge action={getValue<string>()} />,
  },
  {
    id: 'record',
    header: 'Affected Record',
    cell: ({ row }) => (
      <span className="text-sm">
        <span className="text-muted-foreground font-mono text-xs mr-1">
          {row.original.recordId.slice(0, 8)}…
        </span>
        {row.original.recordDescription}
      </span>
    ),
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP Address',
    cell: ({ getValue }) => (
      <code className="font-mono text-xs text-muted-foreground">{getValue<string>()}</code>
    ),
  },
];

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  action: string;
  from: string;
  to: string;
  onActionChange: (val: string) => void;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  onClear: () => void;
  onExport: () => void;
}

/** Filter controls above the audit log table. */
function FilterBar({
  action,
  from,
  to,
  onActionChange,
  onFromChange,
  onToChange,
  onClear,
  onExport,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 pb-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Action type</label>
        <Select value={action} onValueChange={onActionChange}>
          <SelectTrigger className="w-48" data-testid="action-select">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value === '' ? '_all' : opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">From</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-40"
          data-testid="date-from"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-40"
          data-testid="date-to"
        />
      </div>

      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear filters
      </Button>

      <Button variant="outline" size="sm" className="ml-auto" onClick={onExport}>
        Export CSV
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

/** Previous / Next pagination row. */
function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages || 1}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
        Next
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * AuditLogPage — displays a server-side paginated table of admin audit events.
 * Supports filtering by action type and date range, and CSV export.
 */
export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const filters: AuditFilters = { action, from, to, page };

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () => fetchAuditLog(filters),
    retry: false,
  });

  const handleActionChange = useCallback((val: string) => {
    setAction(val === '_all' ? '' : val);
    setPage(1);
  }, []);

  const handleClear = useCallback(() => {
    setAction('');
    setFrom('');
    setTo('');
    setPage(1);
  }, []);

  const handleExport = useCallback(() => {
    exportCsv({ action, from, to });
  }, [action, from, to]);

  const table = useReactTable({
    data: data?.entries ?? [],
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
  });

  const is404 =
    error instanceof ApiError && error.status === 404;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
      </div>

      <FilterBar
        action={action}
        from={from}
        to={to}
        onActionChange={handleActionChange}
        onFromChange={(v) => { setFrom(v); setPage(1); }}
        onToChange={(v) => { setTo(v); setPage(1); }}
        onClear={handleClear}
        onExport={handleExport}
      />

      {is404 && (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Audit log coming soon.
        </div>
      )}

      {error && !is404 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load audit log. Please try refreshing the page.
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b bg-muted/40">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading && <TableSkeletonRows />}

              {!isLoading && table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No audit log entries found.
                  </td>
                </tr>
              )}

              {!isLoading &&
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && !isLoading && (
        <Pagination
          page={page}
          totalPages={data?.totalPages ?? 1}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
}
