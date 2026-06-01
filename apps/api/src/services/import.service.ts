import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { books, bookInventory } from '../db/schema/books.js';
import { AppError } from '../utils/errors.js';
import { z } from 'zod';

// ─── CSV Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a CSV text string into an array of header-keyed row objects.
 * Handles Windows CRLF line endings and UTF-8 BOM.
 */
function parseCSV(text: string): Array<Record<string, string>> {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

// ─── Student Import ───────────────────────────────────────────────────────────

const StudentRowSchema = z.object({
  fullName: z.string().min(1, 'fullName is required'),
  studentId: z.string().min(1, 'studentId is required'),
  gradeLevel: z.coerce.number().int().min(1).max(12),
  email: z.string().email().optional().or(z.literal('')),
  pin: z.string().regex(/^\d{4}$/).optional().or(z.literal('')),
});

type StudentImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

/** Hash a PIN with bcrypt cost 12. */
async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

/** Process a single validated student row — insert or update. */
async function upsertStudent(
  row: z.infer<typeof StudentRowSchema>,
  schoolId: string,
  pinHash: string,
): Promise<'inserted' | 'updated'> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.studentId, row.studentId), eq(users.schoolId, schoolId)))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        fullName: row.fullName,
        gradeLevel: row.gradeLevel,
        pinHash,
        ...(row.email ? { email: row.email } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    return 'updated';
  }

  await db.insert(users).values({
    fullName: row.fullName,
    studentId: row.studentId,
    gradeLevel: row.gradeLevel,
    pinHash,
    ...(row.email ? { email: row.email } : {}),
    role: 'student',
    schoolId,
    isActive: true,
    emailVerified: false,
    approvalStatus: 'approved',
  });
  return 'inserted';
}

/**
 * Import students from parsed CSV text into the given school.
 * Validates each row with Zod, hashes PINs, and bulk-upserts by studentId.
 * @param csvText - Raw CSV file contents.
 * @param schoolId - School to import into.
 */
export async function importStudents(csvText: string, schoolId: string): Promise<StudentImportResult> {
  const rows = parseCSV(csvText);
  const result: StudentImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based, row 1 is header
    const parsed = StudentRowSchema.safeParse(rows[i]);

    if (!parsed.success) {
      result.errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? 'Invalid row' });
      result.skipped++;
      continue;
    }

    const pin = parsed.data.pin || '0000';
    const pinHash = await hashPin(pin);

    try {
      const outcome = await upsertStudent(parsed.data, schoolId, pinHash);
      if (outcome === 'inserted') result.inserted++;
      else result.updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Database error';
      result.errors.push({ row: rowNum, message: msg });
      result.skipped++;
    }
  }

  return result;
}

// ─── Book Import ──────────────────────────────────────────────────────────────

const BookRowSchema = z.object({
  isbn: z.string().optional().or(z.literal('')),
  title: z.string().min(1, 'title is required'),
  author: z.string().min(1, 'author is required'),
  publisher: z.string().optional().or(z.literal('')),
  publicationYear: z.coerce.number().int().min(1000).max(9999).optional().or(z.literal('')),
  genre: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  copies: z.coerce.number().int().min(1).default(1),
  barcode: z.string().optional().or(z.literal('')),
});

type BookImportResult = {
  booksCreated: number;
  booksUpdated: number;
  copiesCreated: number;
  errors: Array<{ row: number; message: string }>;
};

/** Generate a barcode for a copy when none provided. */
function generateBarcode(schoolSlug: string, timestamp: number, n: number): string {
  return `${schoolSlug}-${timestamp}-${n}`;
}

/** Upsert a book record, returning its id and whether it was new. */
async function upsertBook(
  row: z.infer<typeof BookRowSchema>,
  schoolId: string,
): Promise<{ bookId: string; isNew: boolean }> {
  const isbn = row.isbn || null;

  if (isbn) {
    const [existing] = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.isbn, isbn), eq(books.schoolId, schoolId)))
      .limit(1);

    if (existing) {
      await db
        .update(books)
        .set({
          title: row.title,
          author: row.author,
          ...(row.publisher ? { publisher: row.publisher } : {}),
          ...(row.genre ? { genre: row.genre } : {}),
          ...(row.description ? { description: row.description } : {}),
          ...(row.publicationYear && typeof row.publicationYear === 'number'
            ? { publicationYear: row.publicationYear }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(books.id, existing.id));
      return { bookId: existing.id, isNew: false };
    }
  }

  const [created] = await db
    .insert(books)
    .values({
      isbn: isbn ?? undefined,
      title: row.title,
      author: row.author,
      ...(row.publisher ? { publisher: row.publisher } : {}),
      ...(row.genre ? { genre: row.genre } : {}),
      ...(row.description ? { description: row.description } : {}),
      ...(row.publicationYear && typeof row.publicationYear === 'number'
        ? { publicationYear: row.publicationYear }
        : {}),
      schoolId,
    })
    .returning({ id: books.id });

  return { bookId: created!.id, isNew: true };
}

/** Insert copies for a book, skipping barcodes that already exist. */
async function createCopies(
  bookId: string,
  schoolId: string,
  count: number,
  barcodes: string[],
): Promise<number> {
  let created = 0;
  for (let n = 0; n < count; n++) {
    const barcode = barcodes[n] ?? generateBarcode(schoolId.slice(0, 8), Date.now(), n + 1);
    const [existing] = await db
      .select({ id: bookInventory.id })
      .from(bookInventory)
      .where(eq(bookInventory.barcode, barcode))
      .limit(1);

    if (existing) continue;

    await db.insert(bookInventory).values({
      bookId,
      barcode,
      schoolId,
      status: 'available',
    });
    created++;
  }
  return created;
}

/**
 * Import books from parsed CSV text into the given school.
 * Validates each row, upserts book records, and creates inventory copies.
 * @param csvText - Raw CSV file contents.
 * @param schoolId - School to import into.
 */
export async function importBooks(csvText: string, schoolId: string): Promise<BookImportResult> {
  const rows = parseCSV(csvText);
  const result: BookImportResult = { booksCreated: 0, booksUpdated: 0, copiesCreated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = BookRowSchema.safeParse(rows[i]);

    if (!parsed.success) {
      result.errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? 'Invalid row' });
      continue;
    }

    const row = parsed.data;
    const barcodes = row.barcode ? row.barcode.split('|').map((b) => b.trim()).filter(Boolean) : [];
    const copyCount = row.copies ?? 1;

    try {
      const { bookId, isNew } = await upsertBook(row, schoolId);
      if (isNew) result.booksCreated++;
      else result.booksUpdated++;

      const created = await createCopies(bookId, schoolId, copyCount, barcodes);
      result.copiesCreated += created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Database error';
      result.errors.push({ row: rowNum, message: msg });
    }
  }

  return result;
}
