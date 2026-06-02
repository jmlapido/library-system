import { eq, and, inArray, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { checkouts, holds } from '../db/schema/circulation.js';
import { bookInventory, books } from '../db/schema/books.js';
import { AppError } from '../utils/errors.js';
import { refreshBookIndex } from './catalog.service.js';
import { checkAndAwardBadges } from './badges.service.js';
import { updateChallengeProgressOnCheckout } from './challenges.service.js';
import { getSchoolSettings } from './school.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';
import type { CheckoutInput, ReturnInput, AdvanceStageInput, RenewInput, PlaceHoldInput } from 'shared';

const CHECKOUT_DAYS = 14;
const MAX_CHECKOUTS = 5;
const MAX_RENEWALS = 2;
const HOLD_EXPIRY_DAYS = 3;

async function findCopy(barcode: string | undefined, inventoryId: string | undefined, schoolId: string) {
  const where = inventoryId
    ? and(eq(bookInventory.id, inventoryId), eq(bookInventory.schoolId, schoolId))
    : and(eq(bookInventory.barcode, barcode!), eq(bookInventory.schoolId, schoolId));
  const [copy] = await db.select().from(bookInventory).where(where);
  if (!copy) throw new AppError('COPY_NOT_FOUND', 'Copy not found');
  return copy;
}

async function activateNextHold(bookId: string): Promise<void> {
  const [nextHold] = await db.select().from(holds)
    .where(and(eq(holds.bookId, bookId), eq(holds.status, 'pending')))
    .orderBy(holds.position)
    .limit(1);
  if (!nextHold) return;

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + HOLD_EXPIRY_DAYS);
  await db.update(holds)
    .set({ status: 'ready', expirationDate: expiry, notified: false })
    .where(eq(holds.id, nextHold.id));
}

/**
 * Check out a copy to a user. Librarians may specify userId; students use their own JWT sub.
 */
export async function checkout(input: CheckoutInput, requestor: AccessTokenPayload) {
  const schoolId = requestor.schoolId!;
  const userId = input.userId ?? requestor.sub;

  const copy = await findCopy(input.barcode, input.inventoryId, schoolId);
  if (copy.status !== 'available') {
    throw new AppError('COPY_NOT_AVAILABLE', 'This copy is not available for checkout');
  }

  const active = await db.select({ id: checkouts.id }).from(checkouts)
    .where(and(eq(checkouts.userId, userId), inArray(checkouts.status, ['checked_out', 'overdue'])));
  if (active.length >= MAX_CHECKOUTS) {
    throw new AppError('CHECKOUT_LIMIT', `Maximum ${MAX_CHECKOUTS} simultaneous checkouts allowed`);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + CHECKOUT_DAYS);

  const record = (await db.insert(checkouts).values({
    userId,
    bookInventoryId: copy.id,
    dueDate,
    status: 'checked_out',
  }).returning())[0]!;

  await db.update(bookInventory).set({ status: 'checked_out', updatedAt: new Date() }).where(eq(bookInventory.id, copy.id));
  await refreshBookIndex(copy.bookId);
  checkAndAwardBadges(userId, schoolId!).catch(() => {}); // non-blocking
  updateChallengeProgressOnCheckout(userId, schoolId!).catch(() => {}); // non-blocking
  return record;
}

/**
 * Calculate fine amount based on school settings.
 */
function calcFine(
  dueDate: Date,
  returnDate: Date,
  finePerDay: number,
  gracePeriodDays: number,
  maxFineAmount: number,
): string {
  if (returnDate <= dueDate) return '0';
  const rawDays = Math.ceil((returnDate.getTime() - dueDate.getTime()) / 86_400_000);
  const billableDays = Math.max(0, rawDays - gracePeriodDays);
  const amount = billableDays * finePerDay;
  const capped = maxFineAmount > 0 ? Math.min(amount, maxFineAmount) : amount;
  return capped.toFixed(2);
}

/**
 * Initiate return: copy moves to 'returned' (stage 1 of 3). Calculates fine using school settings.
 */
export async function returnBook(input: ReturnInput, schoolId: string) {
  const copy = await findCopy(input.barcode, input.inventoryId, schoolId);
  if (!['checked_out', 'overdue'].includes(copy.status)) {
    throw new AppError('NOT_CHECKED_OUT', 'This copy is not currently checked out');
  }

  const [activeCheckout] = await db.select().from(checkouts)
    .where(and(eq(checkouts.bookInventoryId, copy.id), inArray(checkouts.status, ['checked_out', 'overdue'])));
  if (!activeCheckout) throw new AppError('CHECKOUT_NOT_FOUND', 'No active checkout found for this copy');

  const now = new Date();
  const { settings } = await getSchoolSettings(schoolId);
  const fineAmount = calcFine(
    activeCheckout.dueDate, now,
    settings.fineEnabled ? settings.finePerDay : 0,
    settings.gracePeriodDays,
    settings.maxFineAmount,
  );

  const updated = (await db.update(checkouts)
    .set({ status: 'returned', returnDate: now, lateFee: fineAmount, fineAmount, updatedAt: now } as Parameters<typeof db.update<typeof checkouts>>[0] extends never ? never : object)
    .where(eq(checkouts.id, activeCheckout.id))
    .returning())[0]!;

  await db.update(bookInventory).set({ status: 'returned', updatedAt: now }).where(eq(bookInventory.id, copy.id));
  await refreshBookIndex(copy.bookId);
  return { checkout: updated, fineAmount };
}

/**
 * Advance a returned copy through processing stages: returned→being_processed→shelved→available.
 */
export async function advanceReturnStage(input: AdvanceStageInput, schoolId: string) {
  const copy = await findCopy(input.barcode, input.inventoryId, schoolId);

  const transitions: Record<string, string> = {
    returned: 'being_processed',
    being_processed: 'shelved',
    shelved: 'available',
  };

  const nextStatus = transitions[copy.status];
  if (!nextStatus) {
    throw new AppError('INVALID_STAGE', `Cannot advance copy from status '${copy.status}'`);
  }

  await db.update(bookInventory)
    .set({ status: nextStatus as typeof copy.status, updatedAt: new Date() })
    .where(eq(bookInventory.id, copy.id));

  if (nextStatus === 'available') {
    await refreshBookIndex(copy.bookId);
    await activateNextHold(copy.bookId);
  }

  return { copyId: copy.id, previousStatus: copy.status, newStatus: nextStatus };
}

/**
 * Renew a checkout, extending due date by CHECKOUT_DAYS. Max renewals enforced.
 */
export async function renewCheckout(input: RenewInput, requestor: AccessTokenPayload) {
  const isStaff = ['librarian', 'admin', 'library_assistant'].includes(requestor.role);
  const whereClause = isStaff
    ? eq(checkouts.id, input.checkoutId)
    : and(eq(checkouts.id, input.checkoutId), eq(checkouts.userId, requestor.sub));

  const [checkout] = await db.select().from(checkouts).where(whereClause);
  if (!checkout) throw new AppError('CHECKOUT_NOT_FOUND', 'Checkout not found');
  if (!['checked_out', 'overdue'].includes(checkout.status)) {
    throw new AppError('CHECKOUT_NOT_ACTIVE', 'Only active checkouts can be renewed');
  }
  if ((checkout.renewalCount ?? 0) >= MAX_RENEWALS) {
    throw new AppError('RENEWAL_LIMIT', `Maximum ${MAX_RENEWALS} renewals allowed`);
  }

  const newDue = new Date(Math.max(checkout.dueDate.getTime(), Date.now()));
  newDue.setDate(newDue.getDate() + CHECKOUT_DAYS);

  return (await db.update(checkouts)
    .set({ dueDate: newDue, renewalCount: (checkout.renewalCount ?? 0) + 1, status: 'checked_out' })
    .where(eq(checkouts.id, checkout.id))
    .returning())[0]!;
}

/**
 * Place a hold on a book for the authenticated user.
 */
export async function placeHold(input: PlaceHoldInput, requestor: AccessTokenPayload) {
  const [book] = await db.select({ id: books.id }).from(books)
    .where(and(eq(books.id, input.bookId), eq(books.schoolId, requestor.schoolId!), eq(books.isDeleted, false)));
  if (!book) throw new AppError('BOOK_NOT_FOUND', 'Book not found');

  const [existing] = await db.select({ id: holds.id }).from(holds)
    .where(and(eq(holds.userId, requestor.sub), eq(holds.bookId, input.bookId), inArray(holds.status, ['pending', 'ready'])));
  if (existing) throw new AppError('HOLD_EXISTS', 'You already have an active hold on this book');

  const [maxRow] = await db.select({ pos: holds.position }).from(holds)
    .where(and(eq(holds.bookId, input.bookId), inArray(holds.status, ['pending', 'ready'])))
    .orderBy(desc(holds.position))
    .limit(1);

  const position = (maxRow?.pos ?? 0) + 1;
  return (await db.insert(holds).values({ userId: requestor.sub, bookId: input.bookId, position }).returning())[0]!;
}

/**
 * Cancel a hold. Students cancel only their own; staff can cancel any.
 */
export async function cancelHold(holdId: string, requestor: AccessTokenPayload): Promise<void> {
  const isStaff = ['librarian', 'admin', 'library_assistant'].includes(requestor.role);
  const whereClause = isStaff
    ? eq(holds.id, holdId)
    : and(eq(holds.id, holdId), eq(holds.userId, requestor.sub));

  const [hold] = await db.select().from(holds).where(whereClause);
  if (!hold) throw new AppError('HOLD_NOT_FOUND', 'Hold not found');

  await db.delete(holds).where(eq(holds.id, holdId));

  // Compact queue positions for remaining holds on this book
  const remaining = await db.select({ id: holds.id }).from(holds)
    .where(and(eq(holds.bookId, hold.bookId), inArray(holds.status, ['pending', 'ready'])))
    .orderBy(holds.position);

  for (let i = 0; i < remaining.length; i++) {
    await db.update(holds).set({ position: i + 1 }).where(eq(holds.id, remaining[i]!.id));
  }
}

/** Get active checkouts for a user. */
export async function getUserCheckouts(userId: string) {
  return db.select().from(checkouts)
    .where(and(eq(checkouts.userId, userId), inArray(checkouts.status, ['checked_out', 'overdue'])))
    .orderBy(checkouts.dueDate);
}

/** Get holds with position for a user. */
export async function getUserHolds(userId: string) {
  return db.select().from(holds)
    .where(and(eq(holds.userId, userId), inArray(holds.status, ['pending', 'ready'])))
    .orderBy(holds.position);
}

/** Get all copies in return processing stages for the shelving queue. */
export async function getShelvingQueue(schoolId: string) {
  return db.select().from(bookInventory)
    .where(and(eq(bookInventory.schoolId, schoolId), inArray(bookInventory.status, ['returned', 'being_processed'])))
    .orderBy(bookInventory.updatedAt);
}
