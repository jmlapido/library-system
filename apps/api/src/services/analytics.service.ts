import { sql, eq, and, lt, gte, count, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';
import { books, bookInventory } from '../db/schema/books.js';
import { checkouts, holds } from '../db/schema/circulation.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalBooks: number;
  totalCopies: number;
  totalUsers: number;
  activeCheckouts: number;
  overdueCheckouts: number;
  holdsWaiting: number;
  booksAvailable: number;
}

export interface OverdueItem {
  checkoutId: string;
  userId: string;
  userFullName: string;
  userGradeLevel: number | null;
  bookTitle: string;
  bookAuthor: string;
  barcode: string;
  checkedOutAt: string;
  dueDate: string;
  daysOverdue: number;
}

export interface PopularBook {
  bookId: string;
  title: string;
  author: string;
  genre: string | null;
  checkoutCount: number;
  currentlyAvailable: boolean;
}

export interface ActivityDay {
  date: string;
  checkouts: number;
  returns: number;
}

export interface InventoryAudit {
  statusBreakdown: Array<{ status: string; count: number }>;
  lostCopies: Array<{ copyId: string; barcode: string; bookTitle: string; bookAuthor: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build ISO date string from a Date. */
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** Calculate days between a date string and now (always positive). */
function daysOverdue(dueDateStr: string): number {
  const now = Date.now();
  const due = new Date(dueDateStr).getTime();
  return Math.max(0, Math.floor((now - due) / 86_400_000));
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Return summary dashboard metrics for a school.
 * @param schoolId - School UUID for tenant isolation.
 */
export async function getAdminStats(schoolId: string): Promise<AdminStats> {
  const [totalBooksRow] = await db
    .select({ n: count(books.id) })
    .from(books)
    .where(and(eq(books.schoolId, schoolId), eq(books.isDeleted, false)));

  const [totalCopiesRow] = await db
    .select({ n: count(bookInventory.id) })
    .from(bookInventory)
    .where(eq(bookInventory.schoolId, schoolId));

  const [totalUsersRow] = await db
    .select({ n: count(users.id) })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.isActive, true)));

  const [activeRow] = await db
    .select({ n: count(checkouts.id) })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .where(and(eq(bookInventory.schoolId, schoolId), eq(checkouts.status, 'checked_out')));

  const [overdueRow] = await db
    .select({ n: count(checkouts.id) })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .where(and(
      eq(bookInventory.schoolId, schoolId),
      sql`(${checkouts.status} = 'overdue' OR (${checkouts.status} = 'checked_out' AND ${checkouts.dueDate} < NOW()))`,
    ));

  const [holdsRow] = await db
    .select({ n: count(holds.id) })
    .from(holds)
    .innerJoin(books, eq(holds.bookId, books.id))
    .where(and(eq(books.schoolId, schoolId), eq(holds.status, 'pending')));

  const [availableRow] = await db
    .select({ n: count(bookInventory.id) })
    .from(bookInventory)
    .where(and(eq(bookInventory.schoolId, schoolId), eq(bookInventory.status, 'available')));

  return {
    totalBooks: Number(totalBooksRow?.n ?? 0),
    totalCopies: Number(totalCopiesRow?.n ?? 0),
    totalUsers: Number(totalUsersRow?.n ?? 0),
    activeCheckouts: Number(activeRow?.n ?? 0),
    overdueCheckouts: Number(overdueRow?.n ?? 0),
    holdsWaiting: Number(holdsRow?.n ?? 0),
    booksAvailable: Number(availableRow?.n ?? 0),
  };
}

/**
 * Return all overdue checkouts for a school with user and book details.
 * @param schoolId - School UUID for tenant isolation.
 */
export async function getOverdueReport(schoolId: string): Promise<OverdueItem[]> {
  const rows = await db
    .select({
      checkoutId: checkouts.id,
      userId: users.id,
      userFullName: users.fullName,
      userGradeLevel: users.gradeLevel,
      bookTitle: books.title,
      bookAuthor: books.author,
      barcode: bookInventory.barcode,
      checkedOutAt: checkouts.checkoutDate,
      dueDate: checkouts.dueDate,
    })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .innerJoin(users, eq(checkouts.userId, users.id))
    .where(and(
      eq(bookInventory.schoolId, schoolId),
      sql`(${checkouts.status} = 'overdue' OR (${checkouts.status} = 'checked_out' AND ${checkouts.dueDate} < NOW()))`,
    ));

  return rows.map((r) => ({
    checkoutId: r.checkoutId,
    userId: r.userId,
    userFullName: r.userFullName,
    userGradeLevel: r.userGradeLevel,
    bookTitle: r.bookTitle,
    bookAuthor: r.bookAuthor,
    barcode: r.barcode,
    checkedOutAt: r.checkedOutAt.toISOString(),
    dueDate: r.dueDate.toISOString(),
    daysOverdue: daysOverdue(r.dueDate.toISOString()),
  }));
}

/**
 * Return top N most borrowed books for a school.
 * @param schoolId - School UUID for tenant isolation.
 * @param limit - Maximum number of results (default 10).
 */
export async function getPopularBooks(schoolId: string, limit = 10): Promise<PopularBook[]> {
  const rows = await db
    .select({
      bookId: books.id,
      title: books.title,
      author: books.author,
      genre: books.genre,
      checkoutCount: sql<number>`cast(count(${checkouts.id}) as int)`.as('checkout_count'),
    })
    .from(books)
    .innerJoin(bookInventory, eq(bookInventory.bookId, books.id))
    .innerJoin(checkouts, eq(checkouts.bookInventoryId, bookInventory.id))
    .where(eq(books.schoolId, schoolId))
    .groupBy(books.id, books.title, books.author, books.genre)
    .orderBy(desc(sql`count(${checkouts.id})`))
    .limit(limit);

  const bookIds = rows.map((r) => r.bookId);
  if (bookIds.length === 0) return [];

  const availabilityRows = await db
    .select({ bookId: bookInventory.bookId })
    .from(bookInventory)
    .where(and(
      eq(bookInventory.schoolId, schoolId),
      eq(bookInventory.status, 'available'),
    ));

  const availableSet = new Set(availabilityRows.map((r) => r.bookId));

  return rows.map((r) => ({
    bookId: r.bookId,
    title: r.title,
    author: r.author,
    genre: r.genre,
    checkoutCount: r.checkoutCount,
    currentlyAvailable: availableSet.has(r.bookId),
  }));
}

/**
 * Return daily checkout and return counts for the last N days.
 * Every calendar day in the range is included, even if counts are zero.
 * @param schoolId - School UUID for tenant isolation.
 * @param days - Number of past days to include (default 30).
 */
export async function getActivityReport(schoolId: string, days = 30): Promise<ActivityDay[]> {
  const checkoutRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${checkouts.checkoutDate}), 'YYYY-MM-DD')`.as('day'),
      n: sql<number>`cast(count(*) as int)`.as('n'),
    })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .where(and(
      eq(bookInventory.schoolId, schoolId),
      gte(checkouts.checkoutDate, sql`CURRENT_DATE - INTERVAL '${sql.raw(String(days))} days'`),
    ))
    .groupBy(sql`date_trunc('day', ${checkouts.checkoutDate})`);

  const returnRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${checkouts.returnDate}), 'YYYY-MM-DD')`.as('day'),
      n: sql<number>`cast(count(*) as int)`.as('n'),
    })
    .from(checkouts)
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .where(and(
      eq(bookInventory.schoolId, schoolId),
      eq(checkouts.status, 'returned'),
      gte(checkouts.returnDate, sql`CURRENT_DATE - INTERVAL '${sql.raw(String(days))} days'`),
    ))
    .groupBy(sql`date_trunc('day', ${checkouts.returnDate})`);

  return buildActivityTimeline(checkoutRows, returnRows, days);
}

/** Build a zero-filled timeline array from raw count rows. */
function buildActivityTimeline(
  checkoutRows: Array<{ day: string; n: number }>,
  returnRows: Array<{ day: string; n: number }>,
  days: number,
): ActivityDay[] {
  const checkoutMap = new Map(checkoutRows.map((r) => [r.day, r.n]));
  const returnMap = new Map(returnRows.map((r) => [r.day, r.n]));

  const result: ActivityDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toISODate(d);
    result.push({ date: key, checkouts: checkoutMap.get(key) ?? 0, returns: returnMap.get(key) ?? 0 });
  }

  return result;
}

/**
 * Return inventory status breakdown and list of lost copies for a school.
 * @param schoolId - School UUID for tenant isolation.
 */
export async function getInventoryAudit(schoolId: string): Promise<InventoryAudit> {
  const breakdownRows = await db
    .select({
      status: bookInventory.status,
      count: sql<number>`cast(count(*) as int)`.as('count'),
    })
    .from(bookInventory)
    .where(eq(bookInventory.schoolId, schoolId))
    .groupBy(bookInventory.status);

  const lostRows = await db
    .select({
      copyId: bookInventory.id,
      barcode: bookInventory.barcode,
      bookTitle: books.title,
      bookAuthor: books.author,
    })
    .from(bookInventory)
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(and(eq(bookInventory.schoolId, schoolId), eq(bookInventory.status, 'lost')));

  return {
    statusBreakdown: breakdownRows.map((r) => ({ status: r.status, count: r.count })),
    lostCopies: lostRows,
  };
}
