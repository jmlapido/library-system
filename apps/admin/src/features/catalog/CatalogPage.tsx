import { useState, useCallback, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';
import { AddEditBookDialog, type Book } from './AddEditBookDialog';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface SearchResponse {
  hits: Book[];
}

/** Fetches books from catalog search endpoint. */
async function searchBooks(query: string): Promise<Book[]> {
  const params = new URLSearchParams({ q: query, limit: '50' });
  const result = await api.get<SearchResponse>(`/catalog/search?${params}`);
  return result.hits;
}

/** Deletes a book by id. */
async function deleteBook(id: string): Promise<void> {
  await api.delete(`/catalog/books/${id}`);
}

/** Cover thumbnail with fallback div. */
function CoverCell({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        className="w-8 h-10 object-cover rounded"
      />
    );
  }
  return <div className="w-8 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">?</div>;
}

/** Skeleton rows shown while the table data is loading. */
function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Confirm dialog for destructive delete action. */
function DeleteConfirmDialog({
  open,
  bookTitle,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  bookTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Book</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{bookTitle}</strong>? This cannot be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Catalog Management page — lists books with search, add, edit, and delete.
 * Uses TanStack Table for the data grid and react-query for data fetching.
 */
export function CatalogPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [addEditOpen, setAddEditOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: books = [], isLoading } = useQuery<Book[], Error>({
    queryKey: ['catalog-books', debouncedQuery],
    queryFn: () => searchBooks(debouncedQuery),
  });

  /** Debounces the search input to avoid hammering the API. */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(val), 400);
  }, []);

  /** Opens edit dialog pre-filled with the chosen book. */
  function handleEdit(book: Book) {
    setSelectedBook(book);
    setAddEditOpen(true);
  }

  /** Opens add dialog with blank form. */
  function handleAddBook() {
    setSelectedBook(null);
    setAddEditOpen(true);
  }

  /** Refreshes the book list after a successful add or edit. */
  function handleDialogSuccess() {
    void queryClient.invalidateQueries({ queryKey: ['catalog-books'] });
  }

  /** Executes the delete after the user confirms. */
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBook(deleteTarget.id);
      toast({ title: `"${deleteTarget.title}" deleted` });
      void queryClient.invalidateQueries({ queryKey: ['catalog-books'] });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Delete failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const columns: ColumnDef<Book>[] = buildColumns(handleEdit, setDeleteTarget);

  const table = useReactTable({
    data: books,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Catalog</h1>
        <Button onClick={handleAddBook}>Add Book</Button>
      </div>

      <Input
        placeholder="Search books…"
        value={searchQuery}
        onChange={handleSearchChange}
        className="max-w-sm"
        aria-label="Search books"
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
              <TableSkeletonRows />
            ) : books.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No books found. Add your first book.
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

      <AddEditBookDialog
        open={addEditOpen}
        onOpenChange={setAddEditOpen}
        book={selectedBook}
        onSuccess={handleDialogSuccess}
      />

      {deleteTarget && (
        <DeleteConfirmDialog
          open={deleteTarget != null}
          bookTitle={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

/** Builds TanStack Table column definitions for the books table. */
function buildColumns(
  onEdit: (book: Book) => void,
  onDelete: (book: Book) => void
): ColumnDef<Book>[] {
  return [
    {
      id: 'cover',
      header: '',
      cell: ({ row }) => (
        <CoverCell coverUrl={row.original.coverUrl} title={row.original.title} />
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'author',
      header: 'Author',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'isbn',
      header: 'ISBN',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue<string | null>() ?? '—'}</span>
      ),
    },
    {
      id: 'copies',
      header: 'Copies',
      cell: ({ row }) => `${row.original.availableCopies}/${row.original.totalCopies}`,
    },
    {
      accessorKey: 'genre',
      header: 'Genre',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(row.original)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];
}
