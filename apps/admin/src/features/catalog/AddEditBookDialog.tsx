import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';

/** Shape of a book returned from API. */
export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  genre: string | null;
  readingLevel: string | null;
  description: string | null;
  callNumber: string | null;
  coverUrl: string | null;
  availableCopies: number;
  totalCopies: number;
  publisher?: string | null;
  year?: number | null;
}

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().optional(),
  publisher: z.string().optional(),
  year: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}$/.test(v),
      'Year must be a 4-digit number'
    ),
  isbn: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{10}$|^\d{13}$/.test(v.replace(/-/g, '')),
      'ISBN must be 10 or 13 digits'
    ),
  genre: z.string().optional(),
  readingLevel: z.string().optional(),
  description: z.string().optional(),
  callNumber: z.string().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

interface IsbnLookupData {
  title?: string;
  author?: string;
  publisher?: string;
  year?: number;
  description?: string;
  coverUrl?: string;
  isbn?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, dialog opens in edit mode pre-filled with this book. */
  book?: Book | null;
  /** Called after a successful create or update. */
  onSuccess: () => void;
}

/** Fetches metadata by ISBN and returns the parsed object. */
async function fetchIsbnMetadata(isbn: string): Promise<IsbnLookupData> {
  return api.get<IsbnLookupData>(`/catalog/isbn/${encodeURIComponent(isbn)}`);
}

/** Submits the form data to create a new book. */
async function createBook(data: BookFormData): Promise<Book> {
  return api.post<Book>('/catalog/books', {
    ...data,
    year: data.year ? parseInt(data.year, 10) : undefined,
  });
}

/** Submits the form data to update an existing book. */
async function updateBook(id: string, data: BookFormData): Promise<Book> {
  return api.patch<Book>(`/catalog/books/${id}`, {
    ...data,
    year: data.year ? parseInt(data.year, 10) : undefined,
  });
}

/**
 * Dialog for adding or editing a book in the catalog.
 * In add mode shows "AI Assist" button; in edit mode pre-fills all fields.
 */
export function AddEditBookDialog({ open, onOpenChange, book, onSuccess }: Props) {
  const isEdit = book != null;
  const { toast } = useToast();
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: buildDefaults(book),
  });

  useEffect(() => {
    reset(buildDefaults(book));
  }, [book, reset]);

  const isbnValue = watch('isbn');

  /** Handles ISBN lookup and fills form fields with returned metadata. */
  async function handleIsbnFetch() {
    const rawIsbn = (isbnValue ?? '').replace(/-/g, '').trim();
    if (!rawIsbn) {
      toast({ title: 'Enter an ISBN first', variant: 'destructive' });
      return;
    }
    setIsbnLoading(true);
    try {
      const meta = await fetchIsbnMetadata(rawIsbn);
      if (meta.title) setValue('title', meta.title);
      if (meta.author) setValue('author', meta.author);
      if (meta.publisher) setValue('publisher', meta.publisher);
      if (meta.year) setValue('year', String(meta.year));
      if (meta.description) setValue('description', meta.description);
      toast({ title: 'Metadata fetched from ISBN' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'ISBN lookup failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsbnLoading(false);
    }
  }

  /** Shows placeholder toast for AI Assist (feature pending). */
  function handleAiAssist() {
    toast({ title: 'AI fill coming soon' });
  }

  /** Submits the form; calls create or update endpoint depending on mode. */
  async function onSubmit(data: BookFormData) {
    setSubmitting(true);
    try {
      if (isEdit && book) {
        await updateBook(book.id, data);
        toast({ title: 'Book updated' });
      } else {
        await createBook(data);
        toast({ title: 'Book added' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save book';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Book' : 'Add Book'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldRow label="Title *" error={errors.title?.message}>
            <Input {...register('title')} placeholder="Book title" />
          </FieldRow>

          <FieldRow label="ISBN" error={errors.isbn?.message}>
            <div className="flex gap-2">
              <Input {...register('isbn')} placeholder="10 or 13 digits" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleIsbnFetch}
                disabled={isbnLoading}
              >
                {isbnLoading ? 'Fetching…' : 'Fetch from ISBN'}
              </Button>
            </div>
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Author" error={errors.author?.message}>
              <Input {...register('author')} placeholder="Author name" />
            </FieldRow>
            <FieldRow label="Publisher" error={errors.publisher?.message}>
              <Input {...register('publisher')} placeholder="Publisher" />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Year" error={errors.year?.message}>
              <Input {...register('year')} placeholder="e.g. 2023" maxLength={4} />
            </FieldRow>
            <FieldRow label="Genre" error={errors.genre?.message}>
              <Input {...register('genre')} placeholder="e.g. Fiction" />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Reading Level" error={errors.readingLevel?.message}>
              <Input {...register('readingLevel')} placeholder="e.g. Grade 5" />
            </FieldRow>
            <FieldRow label="Call Number" error={errors.callNumber?.message}>
              <Input {...register('callNumber')} placeholder="e.g. 813.54" />
            </FieldRow>
          </div>

          <FieldRow label="Description" error={errors.description?.message}>
            <textarea
              {...register('description')}
              placeholder="Short description"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </FieldRow>

          <DialogFooter className="flex-row gap-2 pt-2">
            {!isEdit && (
              <Button type="button" variant="outline" onClick={handleAiAssist}>
                AI Assist
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Builds the form defaults from an optional existing book. */
function buildDefaults(book?: Book | null): BookFormData {
  if (!book) {
    return {
      title: '',
      author: '',
      publisher: '',
      year: '',
      isbn: '',
      genre: '',
      readingLevel: '',
      description: '',
      callNumber: '',
    };
  }
  return {
    title: book.title ?? '',
    author: book.author ?? '',
    publisher: book.publisher ?? '',
    year: book.year != null ? String(book.year) : '',
    isbn: book.isbn ?? '',
    genre: book.genre ?? '',
    readingLevel: book.readingLevel ?? '',
    description: book.description ?? '',
    callNumber: book.callNumber ?? '',
  };
}

/** Small wrapper for consistent label + error display. */
function FieldRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
