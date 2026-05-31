import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { PermissionsDialog } from './PermissionsDialog';
import { CreateStaffDialog } from './CreateStaffDialog';

interface ActiveStaff {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

const col = createColumnHelper<ActiveStaff>();

/** Tab displaying active (approved) staff with permission management for admins. */
export function ActiveStaffTab() {
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'admin';
  const [permTarget, setPermTarget] = useState<ActiveStaff | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', 'active'],
    queryFn: () => api.get<ActiveStaff[]>('/admin/staff'),
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
    ...(isAdmin
      ? [
          col.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPermTarget(row.original)}
              >
                Manage Permissions
              </Button>
            ),
          }),
        ]
      : []),
  ];

  const table = useReactTable({
    data: staff,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end p-4">
          <Button onClick={() => setShowCreate(true)}>Create Staff Account</Button>
        </div>
      )}
      {staff.length === 0 ? (
        <p className="p-4 text-muted-foreground">No active staff</p>
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

      <PermissionsDialog staff={permTarget} onClose={() => setPermTarget(null)} />
      <CreateStaffDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
