import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { books, bookInventory } from '../db/schema/books.js';
import { meili, BOOKS_INDEX } from '../lib/meilisearch.js';
import { lookupIsbn } from '../lib/isbn.js';
import { AppError } from '../utils/errors.js';
import { generateEmbedding, buildBookText, storeBookEmbedding } from './embedding.service.js';
import type { Book, BookInventory } from '../db/schema/books.js';
import type {
  CreateBookInput,
  UpdateBookInput,
  AddCopyInput,
  UpdateCopyInput,
  BookSearchInput,
} from 'shared';

let indexReady = false;

async function ensureIndex(): Promise<void> {
  if (indexReady) return;
  await meili.index(BOOKS_INDEX).updateSettings({
    searchableAttributes: ['title', 'author', 'isbn', 'description', 'genre', 'category', 'subjectTags'],
    filterableAttributes: ['schoolId', 'genre', 'category', 'language', 'readingLevel', 'availableCopies'],
    sortableAttributes: ['title', 'publicationYear', 'createdAt'],
  });
  indexReady = true;
}

function escapeFilter(value: string): string {
  return value.replace(/"/g, '\\"');
}

/** Strip undefined values before passing to Drizzle set() — required with exactOptionalPropertyTypes. */
function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

interface BookDocument {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publicationYear: number | null;
  description: string | null;
  coverUrl: string | null;
  category: string | null;
  genre: string | null;
  subjectTags: string[] | null;
  language: string;
  pageCount: number | null;
  readingLevel: string | null;
  deweyDecimal: string | null;
  schoolId: string;
  availableCopies: number;
  totalCopies: number;
  createdAt: string;
}

function buildDocument(book: Book, availableCopies: number, totalCopies: number): BookDocument {
  return {
    id: book.id,
    isbn: book.isbn ?? null,
    title: book.title,
    author: book.author,
    publisher: book.publisher ?? null,
    publicationYear: book.publicationYear ?? null,
    description: book.description ?? null,
    coverUrl: book.coverUrl ?? null,
    category: book.category ?? null,
    genre: book.genre ?? null,
    subjectTags: book.subjectTags ?? null,
    language: book.language,
    pageCount: book.pageCount ?? null,
    readingLevel: book.readingLevel ?? null,
    deweyDecimal: book.deweyDecimal ?? null,
    schoolId: book.schoolId,
    availableCopies,
    totalCopies,
    createdAt: book.createdAt.toISOString(),
  };
}

export async function refreshBookIndex(bookId: string): Promise<void> {
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book || book.isDeleted) {
    await meili.index(BOOKS_INDEX).deleteDocument(bookId).catch(() => undefined);
    return;
  }
  const copies = await db.select({ status: bookInventory.status })
    .from(bookInventory).where(eq(bookInventory.bookId, bookId));
  const available = copies.filter((c) => c.status === 'available').length;
  await meili.index(BOOKS_INDEX).addDocuments([buildDocument(book, available, copies.length)]);
}

/**
 * Create a book record and its first physical copy.
 */
export async function createBook(input: CreateBookInput, schoolId: string) {
  await ensureIndex();

  if (input.isbn) {
    const [existing] = await db.select({ id: books.id }).from(books).where(
      and(eq(books.isbn, input.isbn), eq(books.schoolId, schoolId), eq(books.isDeleted, false))
    );
    if (existing) throw new AppError('DUPLICATE_ISBN', 'A book with this ISBN already exists');
  }

  const { firstCopyBarcode, firstCopyCondition, firstCopyLocation, ...bookData } = input;

  const book = (await db.insert(books).values({ ...bookData, schoolId }).returning())[0]!;

  const copy = (await db.insert(bookInventory).values({
    bookId: book.id,
    barcode: firstCopyBarcode,
    condition: firstCopyCondition,
    location: firstCopyLocation,
    schoolId,
    copyNumber: 1,
    status: 'available',
  }).returning())[0]!;

  await meili.index(BOOKS_INDEX).addDocuments([buildDocument(book, 1, 1)]);

  generateEmbedding(buildBookText({ title: book.title, author: book.author, description: book.description ?? null, genre: book.genre ?? null }))
    .then((vec) => vec ? storeBookEmbedding(book.id, vec) : undefined)
    .catch(() => undefined);

  return { ...book, copies: [copy] };
}

/**
 * Get a single book with all its physical copies.
 */
export async function getBook(id: string, schoolId: string) {
  const [book] = await db.select().from(books).where(
    and(eq(books.id, id), eq(books.schoolId, schoolId), eq(books.isDeleted, false))
  );
  if (!book) throw new AppError('BOOK_NOT_FOUND', 'Book not found');

  const copies = await db.select().from(bookInventory).where(eq(bookInventory.bookId, id));
  return { ...book, copies };
}

/**
 * Update book metadata and re-index in Meilisearch.
 */
export async function updateBook(id: string, input: UpdateBookInput, schoolId: string) {
  const [existing] = await db.select({ id: books.id }).from(books).where(
    and(eq(books.id, id), eq(books.schoolId, schoolId), eq(books.isDeleted, false))
  );
  if (!existing) throw new AppError('BOOK_NOT_FOUND', 'Book not found');

  if (input.isbn) {
    const [dup] = await db.select({ id: books.id }).from(books).where(
      and(eq(books.isbn, input.isbn), eq(books.schoolId, schoolId), eq(books.isDeleted, false))
    );
    if (dup && dup.id !== id) throw new AppError('DUPLICATE_ISBN', 'A book with this ISBN already exists');
  }

  const updated = (await db.update(books)
    .set({ ...compact(input), updatedAt: new Date() })
    .where(eq(books.id, id))
    .returning())[0]!;

  await refreshBookIndex(id);

  generateEmbedding(buildBookText({ title: updated.title, author: updated.author, description: updated.description ?? null, genre: updated.genre ?? null }))
    .then((vec) => vec ? storeBookEmbedding(updated.id, vec) : undefined)
    .catch(() => undefined);

  return updated;
}

/**
 * Soft-delete a book and remove it from the search index.
 */
export async function deleteBook(id: string, schoolId: string): Promise<void> {
  const [existing] = await db.select({ id: books.id }).from(books).where(
    and(eq(books.id, id), eq(books.schoolId, schoolId), eq(books.isDeleted, false))
  );
  if (!existing) throw new AppError('BOOK_NOT_FOUND', 'Book not found');

  await db.update(books).set({ isDeleted: true, updatedAt: new Date() }).where(eq(books.id, id));
  await meili.index(BOOKS_INDEX).deleteDocument(id).catch(() => undefined);
}

/**
 * Search books via Meilisearch with optional filters.
 */
export async function searchBooks(input: BookSearchInput, schoolId: string) {
  await ensureIndex();

  const filters: string[] = [`schoolId = "${escapeFilter(schoolId)}"`];
  if (input.genre) filters.push(`genre = "${escapeFilter(input.genre)}"`);
  if (input.category) filters.push(`category = "${escapeFilter(input.category)}"`);
  if (input.language) filters.push(`language = "${escapeFilter(input.language)}"`);
  if (input.readingLevel) filters.push(`readingLevel = "${escapeFilter(input.readingLevel)}"`);
  if (input.availability === 'true') filters.push('availableCopies > 0');
  if (input.availability === 'false') filters.push('availableCopies = 0');

  const result = await meili.index(BOOKS_INDEX).search(input.q ?? '', {
    filter: filters.join(' AND '),
    limit: input.limit,
    offset: input.offset,
  });

  return {
    hits: result.hits as BookDocument[],
    total: result.estimatedTotalHits ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

/**
 * Look up book metadata from Google Books / Open Library by ISBN.
 */
export async function lookupIsbnMetadata(isbn: string) {
  return lookupIsbn(isbn);
}

/**
 * Add a physical copy to an existing book.
 */
export async function addCopy(bookId: string, input: AddCopyInput, schoolId: string): Promise<BookInventory> {
  const [book] = await db.select({ id: books.id }).from(books).where(
    and(eq(books.id, bookId), eq(books.schoolId, schoolId), eq(books.isDeleted, false))
  );
  if (!book) throw new AppError('BOOK_NOT_FOUND', 'Book not found');

  const existing = await db.select({ copyNumber: bookInventory.copyNumber })
    .from(bookInventory).where(eq(bookInventory.bookId, bookId));
  const maxCopy = existing.reduce((max, c) => Math.max(max, c.copyNumber ?? 0), 0);

  const acquisitionDate = input.acquisitionDate ? new Date(input.acquisitionDate) : undefined;

  const copy = (await db.insert(bookInventory).values({
    bookId,
    barcode: input.barcode,
    condition: input.condition,
    location: input.location,
    schoolId,
    copyNumber: maxCopy + 1,
    status: 'available',
    acquisitionDate,
    purchaseCost: input.purchaseCost?.toString(),
  }).returning())[0]!;

  await refreshBookIndex(bookId);
  return copy;
}

/**
 * Update a physical copy's condition, location, or status.
 */
export async function updateCopy(
  copyId: string, input: UpdateCopyInput, schoolId: string
): Promise<BookInventory> {
  const [existing] = await db.select().from(bookInventory).where(
    and(eq(bookInventory.id, copyId), eq(bookInventory.schoolId, schoolId))
  );
  if (!existing) throw new AppError('COPY_NOT_FOUND', 'Copy not found');

  const updated = (await db.update(bookInventory)
    .set({ ...compact(input), updatedAt: new Date() })
    .where(eq(bookInventory.id, copyId))
    .returning())[0]!;

  await refreshBookIndex(existing.bookId);
  return updated;
}

/**
 * Delete a physical copy. Rejected if the copy is currently checked out.
 */
export async function deleteCopy(copyId: string, schoolId: string): Promise<void> {
  const [existing] = await db.select().from(bookInventory).where(
    and(eq(bookInventory.id, copyId), eq(bookInventory.schoolId, schoolId))
  );
  if (!existing) throw new AppError('COPY_NOT_FOUND', 'Copy not found');
  if (existing.status === 'checked_out') {
    throw new AppError('COPY_IS_CHECKED_OUT', 'Cannot delete a copy that is currently checked out');
  }

  await db.delete(bookInventory).where(eq(bookInventory.id, copyId));
  await refreshBookIndex(existing.bookId);
}
