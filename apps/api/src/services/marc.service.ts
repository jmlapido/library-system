import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { books } from '../db/schema/books.js';
import { bookInventory } from '../db/schema/books.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarcBook {
  isbn?: string;
  title: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  description?: string;
  genre?: string;
}

export type MarcImportResult = {
  booksImported: number;
  booksUpdated: number;
  copiesCreated: number;
  skipped: number;
  errors: Array<{ record: number; message: string }>;
};

// ─── MARC Binary (ISO 2709) Parser ───────────────────────────────────────────

const RT = 0x1d; // record terminator
const FT = 0x1e; // field terminator
const SD = 0x1f; // subfield delimiter

function extractSubfield(fieldBytes: Buffer, code: string): string | undefined {
  const codeChar = code.charCodeAt(0);
  for (let i = 0; i < fieldBytes.length - 1; i++) {
    if (fieldBytes[i] === SD && fieldBytes[i + 1] === codeChar) {
      const start = i + 2;
      let end = fieldBytes.length;
      for (let j = start; j < fieldBytes.length; j++) {
        if (fieldBytes[j] === SD || fieldBytes[j] === FT) {
          end = j;
          break;
        }
      }
      return fieldBytes.subarray(start, end).toString('utf8').trim();
    }
  }
  return undefined;
}

interface DirEntry {
  tag: string;
  length: number;
  start: number;
}

function parseDirectory(record: Buffer, baseAddr: number): DirEntry[] {
  const entries: DirEntry[] = [];
  let pos = 24;
  while (pos + 12 <= baseAddr && record[pos] !== FT) {
    const tag = record.subarray(pos, pos + 3).toString('ascii');
    const length = parseInt(record.subarray(pos + 3, pos + 7).toString('ascii'), 10);
    const start = parseInt(record.subarray(pos + 7, pos + 12).toString('ascii'), 10);
    if (!isNaN(length) && !isNaN(start)) entries.push({ tag, length, start });
    pos += 12;
  }
  return entries;
}

/** Parse one ISO 2709 record buffer into a MarcBook (or null if no title). */
function parseBinaryRecord(record: Buffer): MarcBook | null {
  if (record.length < 24) return null;
  const baseAddrStr = record.subarray(12, 17).toString('ascii');
  const baseAddr = parseInt(baseAddrStr, 10);
  if (isNaN(baseAddr) || baseAddr >= record.length) return null;

  const dir = parseDirectory(record, baseAddr);
  const fieldMap = new Map<string, Buffer[]>();
  for (const e of dir) {
    const end = Math.min(baseAddr + e.start + e.length, record.length);
    const data = record.subarray(baseAddr + e.start, end);
    if (!fieldMap.has(e.tag)) fieldMap.set(e.tag, []);
    fieldMap.get(e.tag)!.push(data);
  }

  const sf = (tag: string, code: string): string | undefined => {
    const buf = fieldMap.get(tag)?.[0];
    if (!buf || buf.length < 2) return undefined;
    return extractSubfield(buf.subarray(2), code); // skip 2 indicator bytes
  };

  const titleA = sf('245', 'a');
  if (!titleA) return null;
  const titleB = sf('245', 'b');
  const title = titleB
    ? `${titleA.replace(/[/:,\s]+$/, '')} ${titleB}`.trim()
    : titleA.replace(/[/:,\s]+$/, '');

  const isbnRaw = sf('020', 'a');
  const isbn = isbnRaw?.replace(/[^0-9Xx]/g, '').slice(0, 13).toUpperCase() || undefined;

  const authorRaw = sf('100', 'a') ?? sf('110', 'a');
  const author = authorRaw?.replace(/[,.\s]+$/, '') || undefined;

  const publisher =
    (sf('260', 'b') ?? sf('264', 'b'))?.replace(/[,.\s]+$/, '') || undefined;

  const yearStr = sf('260', 'c') ?? sf('264', 'c');
  const yearMatch = yearStr?.match(/\d{4}/);
  const publicationYear = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

  const description = sf('520', 'a') || undefined;
  const genre = sf('650', 'a')?.replace(/[,.\s]+$/, '') || undefined;

  return { isbn, title, author, publisher, publicationYear, description, genre };
}

/**
 * Split a binary MARC buffer into individual record buffers.
 * Each record ends with 0x1D (record terminator).
 */
function splitBinaryMarc(buf: Buffer): Buffer[] {
  const records: Buffer[] = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === RT) {
      records.push(buf.subarray(start, i + 1));
      start = i + 1;
    }
  }
  return records;
}

/** Parse all records from a binary MARC (.mrc) buffer. */
function parseMarcBinary(buf: Buffer): MarcBook[] {
  return splitBinaryMarc(buf)
    .map(parseBinaryRecord)
    .filter((b): b is MarcBook => b !== null);
}

// ─── MARCXML Parser ───────────────────────────────────────────────────────────

/**
 * Extract the first matching subfield value from a MARCXML record string.
 * Handles both single and multiple datafield occurrences; returns first match.
 */
function xmlSubfield(record: string, tag: string, code: string): string | undefined {
  const dfRe = new RegExp(`<datafield[^>]+tag="${tag}"[^>]*>([\\s\\S]*?)<\\/datafield>`, 'g');
  let dfMatch: RegExpExecArray | null;
  while ((dfMatch = dfRe.exec(record)) !== null) {
    const sfRe = new RegExp(`<subfield[^>]+code="${code}"[^>]*>([^<]*)<\\/subfield>`);
    const sfMatch = sfRe.exec(dfMatch[1]);
    if (sfMatch?.[1]) return sfMatch[1].trim();
  }
  return undefined;
}

/** Parse a MARCXML string into MarcBook records. */
function parseMarcXml(xml: string): MarcBook[] {
  const books: MarcBook[] = [];
  const recordRe = /<record[^>]*>([\s\S]*?)<\/record>/g;
  let rMatch: RegExpExecArray | null;

  while ((rMatch = recordRe.exec(xml)) !== null) {
    const rec = rMatch[1];
    const sf = (tag: string, code: string) => xmlSubfield(rec, tag, code);

    const titleA = sf('245', 'a');
    if (!titleA) continue;

    const titleB = sf('245', 'b');
    const title = titleB
      ? `${titleA.replace(/[/:,\s]+$/, '')} ${titleB}`.trim()
      : titleA.replace(/[/:,\s]+$/, '');

    const isbnRaw = sf('020', 'a');
    const isbn = isbnRaw?.replace(/[^0-9Xx]/g, '').slice(0, 13).toUpperCase() || undefined;

    const authorRaw = sf('100', 'a') ?? sf('110', 'a');
    const author = authorRaw?.replace(/[,.\s]+$/, '') || undefined;

    const publisher =
      (sf('260', 'b') ?? sf('264', 'b'))?.replace(/[,.\s]+$/, '') || undefined;

    const yearStr = sf('260', 'c') ?? sf('264', 'c');
    const yearMatch = yearStr?.match(/\d{4}/);
    const publicationYear = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

    const description = sf('520', 'a') || undefined;
    const genre = sf('650', 'a')?.replace(/[,.\s]+$/, '') || undefined;

    books.push({ isbn, title, author, publisher, publicationYear, description, genre });
  }

  return books;
}

// ─── Format Detection ─────────────────────────────────────────────────────────

/** Auto-detect MARC format from file content and return extracted records. */
function extractMarcRecords(content: Buffer): MarcBook[] {
  const peek = content.subarray(0, 5).toString('utf8').trimStart();
  if (peek.startsWith('<')) return parseMarcXml(content.toString('utf8'));
  return parseMarcBinary(content);
}

// ─── DB Upsert ────────────────────────────────────────────────────────────────

async function upsertMarcBook(
  book: MarcBook,
  schoolId: string,
): Promise<{ bookId: string; isNew: boolean }> {
  if (book.isbn) {
    const [existing] = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.isbn, book.isbn), eq(books.schoolId, schoolId)))
      .limit(1);

    if (existing) {
      await db
        .update(books)
        .set({
          title: book.title,
          ...(book.author ? { author: book.author } : {}),
          ...(book.publisher ? { publisher: book.publisher } : {}),
          ...(book.publicationYear ? { publicationYear: book.publicationYear } : {}),
          ...(book.description ? { description: book.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(books.id, existing.id));
      return { bookId: existing.id, isNew: false };
    }
  }

  const [created] = await db
    .insert(books)
    .values({
      isbn: book.isbn ?? undefined,
      title: book.title,
      author: book.author ?? 'Unknown',
      ...(book.publisher ? { publisher: book.publisher } : {}),
      ...(book.publicationYear ? { publicationYear: book.publicationYear } : {}),
      ...(book.description ? { description: book.description } : {}),
      ...(book.genre ? { genre: book.genre } : {}),
      schoolId,
    })
    .returning({ id: books.id });

  return { bookId: created!.id, isNew: true };
}

async function addDefaultCopy(bookId: string, schoolId: string): Promise<boolean> {
  const barcode = `MARC-${schoolId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.insert(bookInventory).values({ bookId, barcode, schoolId, status: 'available' });
  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Import books from a MARC file (binary ISO 2709 or MARCXML).
 * Auto-detects format from content. Creates one inventory copy per new book.
 * @param content - Raw file bytes from the uploaded MARC file.
 * @param schoolId - School to import into.
 */
export async function importMarc(content: Buffer, schoolId: string): Promise<MarcImportResult> {
  const marcBooks = extractMarcRecords(content);
  const result: MarcImportResult = {
    booksImported: 0,
    booksUpdated: 0,
    copiesCreated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < marcBooks.length; i++) {
    const book = marcBooks[i];
    const recordNum = i + 1;
    try {
      const { bookId, isNew } = await upsertMarcBook(book!, schoolId);
      if (isNew) {
        result.booksImported++;
        await addDefaultCopy(bookId, schoolId);
        result.copiesCreated++;
      } else {
        result.booksUpdated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Database error';
      result.errors.push({ record: recordNum, message: msg });
      result.skipped++;
    }
  }

  return result;
}
