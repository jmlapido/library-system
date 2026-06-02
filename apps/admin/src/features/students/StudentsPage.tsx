import { useState, useCallback, useRef } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const StudentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  studentId: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  role: z.string(),
  approvalStatus: z.string(),
  activeCheckoutsCount: z.number().default(0),
  createdAt: z.string(),
});

const StudentListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(StudentSchema),
});

const CheckoutItemSchema = z.object({
  id: z.string().uuid(),
  bookTitle: z.string(),
  dueDate: z.string(),
  status: z.enum(['checked_out', 'overdue']),
});

const CheckoutListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(CheckoutItemSchema),
});

const ResetPinResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ newPin: z.string() }),
});

export type Student = z.infer<typeof StudentSchema>;
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Fetches the student roster, optionally filtered by a search query.
 */
async function fetchStudents(query: string): Promise<Student[]> {
  const params = new URLSearchParams({ role: 'student', limit: '100' });
  if (query) params.set('q', query);
  const raw = await api.get<unknown>(`/admin/students?${params}`);
  const parsed = StudentListResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // API returns unwrapped data array (api.ts strips the envelope)
    const arrayParsed = z.array(StudentSchema).safeParse(raw);
    if (!arrayParsed.success) return [];
    return arrayParsed.data;
  }
  return parsed.data.data;
}

/**
 * Fetches active checkouts for a given student (admin view).
 */
async function fetchStudentCheckouts(studentId: string): Promise<CheckoutItem[]> {
  const raw = await api.get<unknown>(`/admin/students/${studentId}/checkouts`);
  const arrayParsed = z.array(CheckoutItemSchema).safeParse(raw);
  if (arrayParsed.success) return arrayParsed.data;
  const wrapped = CheckoutListResponseSchema.safeParse(raw);
  if (wrapped.success) return wrapped.data.data;
  return [];
}

/**
 * Posts a PIN reset request for the given student.
 * Returns the new PIN string.
 */
async function resetStudentPin(studentId: string): Promise<string> {
  const raw = await api.post<unknown>(`/admin/students/${studentId}/reset-pin`, {});
  const parsed = ResetPinResponseSchema.safeParse({ success: true, data: raw });
  if (parsed.success) return parsed.data.data.newPin;
  const direct = z.object({ newPin: z.string() }).safeParse(raw);
  if (direct.success) return direct.data.newPin;
  throw new ApiError(500, 'PARSE_ERROR', 'Unexpected PIN reset response');
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Skeleton placeholder rows shown while students are loading. */
function TableSkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Inline checkout list inside the detail sheet. */
function CheckoutList({ studentId }: { studentId: string }) {
  const { data: checkouts = [], isLoading, isError } = useQuery<CheckoutItem[], Error>({
    queryKey: ['student-checkouts', studentId],
    queryFn: () => fetchStudentCheckouts(studentId),
    retry: false,
  });

  if (isError) {
    return <p className="text-sm text-muted-foreground">Data unavailable.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (checkouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No active checkouts.</p>;
  }

  return (
    <ul className="space-y-2">
      {checkouts.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{c.bookTitle}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-muted-foreground text-xs">
              Due {new Date(c.dueDate).toLocaleDateString()}
            </span>
            {c.status === 'overdue' && (
              <Badge variant="destructive">Overdue</Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Side sheet showing full profile + checkouts for one student. */
function StudentDetailSheet({
  student,
  open,
  onClose,
}: {
  student: Student | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [resetting, setResetting] = useState(false);

  async function handleResetPin() {
    if (!student) return;
    setResetting(true);
    try {
      const newPin = await resetStudentPin(student.id);
      toast({ title: `PIN reset. New PIN: ${newPin}` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'PIN reset failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto" side="right">
        {student && (
          <>
            <SheetHeader>
              <SheetTitle>{student.name}</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <ProfileSection student={student} />

              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Active Checkouts ({student.activeCheckoutsCount})
                </h3>
                <CheckoutList studentId={student.id} />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPin}
                disabled={resetting}
                className="w-full"
              >
                {resetting ? 'Resetting…' : 'Reset PIN'}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Profile info grid inside the sheet. */
function ProfileSection({ student }: { student: Student }) {
  const isActive = student.approvalStatus === 'approved';
  const joinDate = new Date(student.createdAt).toLocaleDateString();

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Email</dt>
      <dd className="truncate">{student.email}</dd>
      <dt className="text-muted-foreground">Student ID</dt>
      <dd>{student.studentId ?? '—'}</dd>
      <dt className="text-muted-foreground">Grade</dt>
      <dd>{student.grade ?? '—'}</dd>
      <dt className="text-muted-foreground">Role</dt>
      <dd className="capitalize">{student.role}</dd>
      <dt className="text-muted-foreground">Status</dt>
      <dd>
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      </dd>
      <dt className="text-muted-foreground">Joined</dt>
      <dd>{joinDate}</dd>
    </dl>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────

/** Builds TanStack Table column definitions for the students table. */
function buildColumns(onView: (student: Student) => void): ColumnDef<Student>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'studentId',
      header: 'Student ID / Email',
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.studentId ?? '—'}</div>
          <div className="text-muted-foreground text-xs">{row.original.email}</div>
        </div>
      ),
    },
    {
      id: 'grade',
      header: 'Grade',
      cell: ({ row }) => row.original.grade ?? '—',
    },
    {
      id: 'activeCheckouts',
      header: 'Active Checkouts',
      cell: ({ row }) => row.original.activeCheckoutsCount,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const active = row.original.approvalStatus === 'approved';
        return (
          <Badge variant={active ? 'default' : 'secondary'}>
            {active ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
    {
      id: 'joined',
      header: 'Joined',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => onView(row.original)}>
          View
        </Button>
      ),
    },
  ];
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * StudentsPage — lists enrolled students with search, and a detail sheet
 * showing profile info, checkouts, and PIN reset.
 */
export function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: students = [], isLoading } = useQuery<Student[], Error>({
    queryKey: ['admin-students', debouncedQuery],
    queryFn: () => fetchStudents(debouncedQuery),
    retry: false,
  });

  /** Debounces the search input to avoid hammering the API. */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(val), 400);
  }, []);

  /** Opens the detail sheet for the chosen student. */
  function handleView(student: Student) {
    setSelectedStudent(student);
    setSheetOpen(true);
  }

  function handleSheetClose() {
    setSheetOpen(false);
  }

  const columns = buildColumns(handleView);

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Students</h1>
      </div>

      <Input
        placeholder="Search by name or student ID…"
        value={searchQuery}
        onChange={handleSearchChange}
        className="max-w-sm"
        aria-label="Search students"
      />

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeletonRows cols={7} />
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No students found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <StudentDetailSheet
        student={selectedStudent}
        open={sheetOpen}
        onClose={handleSheetClose}
      />
    </div>
  );
}
