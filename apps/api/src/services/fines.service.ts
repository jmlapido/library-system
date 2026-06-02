import { eq, gt, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { checkouts } from '../db/schema/circulation.js';
import { bookInventory, books } from '../db/schema/books.js';
import { users } from '../db/schema/users.js';
import { AppError } from '../utils/errors.js';

export type FineStatus = 'outstanding' | 'paid' | 'waived' | 'all';

/** Shape returned for each fine record in the list. */
export interface FineRecord {
  checkoutId: string;
  userId: string;
  userName: string;
  bookTitle: string;
  dueDate: string;
  returnDate: string | null;
  fineAmount: number;
  finePaid: boolean;
  fineWaived: boolean;
  daysOverdue: number;
}

/**
 * Build the where clause for fine status filtering.
 * All returned rows must have fine_amount > 0.
 */
function buildStatusFilter(status: FineStatus) {
  const hasAFine = gt(checkouts.fineAmount, '0');
  if (status === 'all') return hasAFine;
  if (status === 'paid') return and(hasAFine, eq(checkouts.finePaid, true));
  if (status === 'waived') return and(hasAFine, eq(checkouts.fineWaived, true));
  // outstanding = not paid AND not waived
  return and(hasAFine, eq(checkouts.finePaid, false), eq(checkouts.fineWaived, false));
}

/**
 * List fines for all checkouts in a school, filtered by status.
 */
export async function listFines(schoolId: string, status: FineStatus): Promise<FineRecord[]> {
  const rows = await db
    .select({
      checkoutId: checkouts.id,
      userId: checkouts.userId,
      userName: users.fullName,
      bookTitle: books.title,
      dueDate: checkouts.dueDate,
      returnDate: checkouts.returnDate,
      fineAmount: checkouts.fineAmount,
      finePaid: checkouts.finePaid,
      fineWaived: checkouts.fineWaived,
    })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .innerJoin(books, and(eq(bookInventory.bookId, books.id), eq(books.schoolId, schoolId)))
    .innerJoin(users, eq(checkouts.userId, users.id))
    .where(buildStatusFilter(status));

  return rows.map((r) => {
    const due = r.dueDate.getTime();
    const ret = r.returnDate ? r.returnDate.getTime() : Date.now();
    const daysOverdue = Math.max(0, Math.ceil((ret - due) / 86_400_000));
    return {
      checkoutId: r.checkoutId,
      userId: r.userId,
      userName: r.userName,
      bookTitle: r.bookTitle,
      dueDate: r.dueDate.toISOString(),
      returnDate: r.returnDate?.toISOString() ?? null,
      fineAmount: Number(r.fineAmount ?? 0),
      finePaid: r.finePaid ?? false,
      fineWaived: r.fineWaived ?? false,
      daysOverdue,
    };
  });
}

/**
 * Waive a fine. Sets fineWaived, fineWaivedBy, fineWaivedAt.
 */
export async function waiveFine(
  checkoutId: string,
  actorId: string,
): Promise<{ checkoutId: string; fineAmount: number; fineWaived: true }> {
  const [row] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId));
  if (!row) throw new AppError('CHECKOUT_NOT_FOUND', 'Checkout not found');
  if (Number(row.fineAmount ?? 0) === 0) throw new AppError('NO_FINE', 'No fine on this checkout');

  await db.update(checkouts).set({
    fineWaived: true,
    fineWaivedBy: actorId,
    fineWaivedAt: new Date(),
  }).where(eq(checkouts.id, checkoutId));

  return { checkoutId, fineAmount: Number(row.fineAmount), fineWaived: true };
}

/**
 * Mark a fine as paid.
 */
export async function markFinePaid(
  checkoutId: string,
): Promise<{ checkoutId: string; fineAmount: number; finePaid: true }> {
  const [row] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId));
  if (!row) throw new AppError('CHECKOUT_NOT_FOUND', 'Checkout not found');
  if (Number(row.fineAmount ?? 0) === 0) throw new AppError('NO_FINE', 'No fine on this checkout');

  await db.update(checkouts).set({ finePaid: true }).where(eq(checkouts.id, checkoutId));

  return { checkoutId, fineAmount: Number(row.fineAmount), finePaid: true };
}
