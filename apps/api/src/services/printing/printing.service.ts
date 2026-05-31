import { db } from '../../db/index.js';
import { bookInventory, books } from '../../db/schema/books.js';
import { schools } from '../../db/schema/schools.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../../utils/errors.js';
import {
  generateSpineLabelPdf,
  generateCoverLabelPdf,
  generateMetadataCardPdf,
  generateBulkLabelPdf,
} from './pdf.js';
import { generateSpineZpl } from './zpl.js';
import type { CopyLabelData } from './types.js';

/**
 * Fetch all data needed to render a copy label.
 * @param copyId - The UUID of the book_inventory row.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
async function getCopyLabelData(copyId: string, schoolId: string): Promise<CopyLabelData> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  const rows = await db
    .select({
      copyId: bookInventory.id,
      barcode: bookInventory.barcode,
      copyNumber: bookInventory.copyNumber,
      condition: bookInventory.condition,
      location: bookInventory.location,
      bookTitle: books.title,
      bookAuthor: books.author,
      isbn: books.isbn,
      deweyDecimal: books.deweyDecimal,
      publisher: books.publisher,
      publicationYear: books.publicationYear,
      schoolId: books.schoolId,
    })
    .from(bookInventory)
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(and(eq(bookInventory.id, copyId), eq(books.schoolId, schoolId)))
    .limit(1);

  if (!rows[0]) throw new AppError('NOT_FOUND', 'Copy not found');

  const school = await db
    .select({ name: schools.name })
    .from(schools)
    .where(eq(schools.id, rows[0].schoolId))
    .limit(1);

  return { ...rows[0], schoolName: school[0]?.name ?? 'School Library', appUrl };
}

/**
 * Generate a spine label PDF for a single copy.
 * @param copyId - The UUID of the book_inventory row.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
export async function getSpineLabelPdf(copyId: string, schoolId: string): Promise<Buffer> {
  return generateSpineLabelPdf(await getCopyLabelData(copyId, schoolId));
}

/**
 * Generate a cover label PDF for a single copy.
 * @param copyId - The UUID of the book_inventory row.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
export async function getCoverLabelPdf(copyId: string, schoolId: string): Promise<Buffer> {
  return generateCoverLabelPdf(await getCopyLabelData(copyId, schoolId));
}

/**
 * Generate a metadata card PDF for a single copy.
 * @param copyId - The UUID of the book_inventory row.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
export async function getMetadataCardPdf(copyId: string, schoolId: string): Promise<Buffer> {
  return generateMetadataCardPdf(await getCopyLabelData(copyId, schoolId));
}

/**
 * Generate ZPL spine label string for a single copy.
 * @param copyId - The UUID of the book_inventory row.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
export async function getSpineZpl(copyId: string, schoolId: string): Promise<string> {
  return generateSpineZpl(await getCopyLabelData(copyId, schoolId));
}

/**
 * Generate a bulk label PDF for multiple copies.
 * @param copyIds - Array of book_inventory UUIDs.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
export async function getBulkLabelsPdf(copyIds: string[], schoolId: string): Promise<Buffer> {
  const allData = await Promise.all(copyIds.map((id) => getCopyLabelData(id, schoolId)));
  return generateBulkLabelPdf(allData);
}

/**
 * Look up a book inventory copy by barcode.
 * @param barcode - The barcode string on the copy.
 * @param schoolId - The caller's school UUID for cross-school isolation.
 */
export async function getCopyByBarcode(barcode: string, schoolId: string): Promise<{
  copy: typeof bookInventory.$inferSelect;
  book: typeof books.$inferSelect;
}> {
  const rows = await db
    .select()
    .from(bookInventory)
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(and(eq(bookInventory.barcode, barcode), eq(books.schoolId, schoolId)))
    .limit(1);

  if (!rows[0]) throw new AppError('NOT_FOUND', 'Copy not found');
  return { copy: rows[0].book_inventory, book: rows[0].books };
}
