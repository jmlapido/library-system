import { eq, and, inArray, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookInventory, books } from '../db/schema/books.js';
import { AppError } from '../utils/errors.js';

/** Condition values accepted by the API (subset of bookConditionEnum). */
export type CopyCondition = 'excellent' | 'good' | 'fair' | 'poor';

/** One item in the audit `found` or `missing` array. */
export interface AuditFoundItem {
  barcode: string;
  title: string;
  callNumber: string | null;
}

/** One item in the audit `missing` array — includes lastSeen timestamp. */
export interface AuditMissingItem extends AuditFoundItem {
  lastSeen: string | null;
}

/** One item in the audit `unexpected` array. */
export interface AuditUnexpectedItem {
  barcode: string;
  title: string;
  status: string;
}

/** Full audit result returned by runShelfAudit. */
export interface AuditResult {
  scannedCount: number;
  expectedCount: number;
  found: AuditFoundItem[];
  missing: AuditMissingItem[];
  unexpected: AuditUnexpectedItem[];
}

/** One row in the missing books report. */
export interface MissingBookRow {
  copyId: string;
  barcode: string;
  bookTitle: string;
  callNumber: string | null;
  lastStatusChange: string;
  daysSinceActivity: number;
}

const STALE_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/**
 * Run a shelf audit for the given school.
 * Compares physically scanned barcodes against DB copies with status
 * 'available' or 'shelved' to produce found / missing / unexpected lists.
 */
export async function runShelfAudit(
  schoolId: string,
  scannedBarcodes: string[],
): Promise<AuditResult> {
  const expectedRows = await db
    .select({
      barcode: bookInventory.barcode,
      title: books.title,
      callNumber: books.deweyDecimal,
      status: bookInventory.status,
      updatedAt: bookInventory.updatedAt,
    })
    .from(bookInventory)
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(
      and(
        eq(bookInventory.schoolId, schoolId),
        inArray(bookInventory.status, ['available', 'shelved']),
      ),
    );

  const expectedMap = new Map(expectedRows.map((r) => [r.barcode, r]));
  const scannedSet = new Set(scannedBarcodes);

  const found: AuditFoundItem[] = [];
  const missing: AuditMissingItem[] = [];

  for (const [barcode, row] of expectedMap) {
    if (scannedSet.has(barcode)) {
      found.push({ barcode, title: row.title, callNumber: row.callNumber ?? null });
    } else {
      missing.push({
        barcode,
        title: row.title,
        callNumber: row.callNumber ?? null,
        lastSeen: row.updatedAt.toISOString(),
      });
    }
  }

  const unexpected = await buildUnexpectedList(schoolId, scannedBarcodes, expectedMap);

  return {
    scannedCount: scannedBarcodes.length,
    expectedCount: expectedRows.length,
    found,
    missing,
    unexpected,
  };
}

/**
 * Build the unexpected list: barcodes that were scanned but are NOT in the
 * expected (available/shelved) set — they exist in the DB with a different status.
 */
async function buildUnexpectedList(
  schoolId: string,
  scannedBarcodes: string[],
  expectedMap: Map<string, unknown>,
): Promise<AuditUnexpectedItem[]> {
  const unexpectedBarcodes = scannedBarcodes.filter((b) => !expectedMap.has(b));
  if (unexpectedBarcodes.length === 0) return [];

  const rows = await db
    .select({
      barcode: bookInventory.barcode,
      title: books.title,
      status: bookInventory.status,
    })
    .from(bookInventory)
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(
      and(
        eq(bookInventory.schoolId, schoolId),
        inArray(bookInventory.barcode, unexpectedBarcodes),
      ),
    );

  return rows.map((r) => ({
    barcode: r.barcode,
    title: r.title,
    status: r.status,
  }));
}

/**
 * Return copies marked 'available' whose updatedAt is older than STALE_DAYS.
 * Proxy for "possibly missing from shelf" when no audit history is stored.
 */
export async function getMissingBooks(schoolId: string): Promise<MissingBookRow[]> {
  const cutoff = new Date(Date.now() - STALE_DAYS * MS_PER_DAY);

  const rows = await db
    .select({
      copyId: bookInventory.id,
      barcode: bookInventory.barcode,
      bookTitle: books.title,
      callNumber: books.deweyDecimal,
      updatedAt: bookInventory.updatedAt,
    })
    .from(bookInventory)
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(
      and(
        eq(bookInventory.schoolId, schoolId),
        eq(bookInventory.status, 'available'),
        lt(bookInventory.updatedAt, cutoff),
      ),
    );

  const now = Date.now();
  return rows.map((r) => ({
    copyId: r.copyId,
    barcode: r.barcode,
    bookTitle: r.bookTitle,
    callNumber: r.callNumber ?? null,
    lastStatusChange: r.updatedAt.toISOString(),
    daysSinceActivity: Math.floor((now - r.updatedAt.getTime()) / MS_PER_DAY),
  }));
}

/**
 * Update the condition of a single copy.
 * Throws AppError('COPY_NOT_FOUND') if the copy does not belong to the school.
 */
export async function updateCopyCondition(
  copyId: string,
  schoolId: string,
  condition: CopyCondition,
): Promise<{ copyId: string; condition: CopyCondition }> {
  const [existing] = await db
    .select({ id: bookInventory.id })
    .from(bookInventory)
    .where(and(eq(bookInventory.id, copyId), eq(bookInventory.schoolId, schoolId)));

  if (!existing) throw new AppError('COPY_NOT_FOUND', 'Copy not found');

  await db
    .update(bookInventory)
    .set({ condition, updatedAt: new Date() })
    .where(eq(bookInventory.id, copyId));

  return { copyId, condition };
}
