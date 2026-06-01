import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { readingLists, readingListItems } from '../db/schema/readingLists.js';
import { books } from '../db/schema/books.js';
import { users } from '../db/schema/users.js';
import { AppError } from '../utils/errors.js';
import { checkAndAwardBadges } from './badges.service.js';

/** Verify ownership and school isolation for a list. Throws LIST_NOT_FOUND or LIST_ACCESS_DENIED. */
async function assertListOwner(listId: string, userId: string, schoolId: string) {
  const [row] = await db
    .select({ id: readingLists.id, userId: readingLists.userId, userSchoolId: users.schoolId })
    .from(readingLists)
    .innerJoin(users, eq(users.id, readingLists.userId))
    .where(eq(readingLists.id, listId))
    .limit(1);

  if (!row) throw new AppError('LIST_NOT_FOUND', 'Reading list not found');
  if (row.userId !== userId || row.userSchoolId !== schoolId) {
    throw new AppError('LIST_ACCESS_DENIED', 'You do not have access to this list');
  }
  return row;
}

/**
 * Get all reading lists for a user with item counts.
 * @param userId - Authenticated user's ID.
 */
export async function getMyLists(userId: string) {
  const rows = await db
    .select({
      id: readingLists.id,
      title: readingLists.title,
      description: readingLists.description,
      isPublic: readingLists.isPublic,
      createdAt: readingLists.createdAt,
      itemCount: count(readingListItems.id),
    })
    .from(readingLists)
    .leftJoin(readingListItems, eq(readingListItems.listId, readingLists.id))
    .where(eq(readingLists.userId, userId))
    .groupBy(readingLists.id);

  return rows;
}

/**
 * Get a single reading list with its books. Verifies ownership.
 * @param listId - The reading list UUID.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT for isolation.
 */
export async function getListWithItems(listId: string, userId: string, schoolId: string) {
  await assertListOwner(listId, userId, schoolId);

  const [list] = await db
    .select()
    .from(readingLists)
    .where(eq(readingLists.id, listId))
    .limit(1);

  const items = await db
    .select({
      id: readingListItems.id,
      bookId: readingListItems.bookId,
      status: readingListItems.status,
      addedAt: readingListItems.addedAt,
      title: books.title,
      author: books.author,
      coverUrl: books.coverUrl,
    })
    .from(readingListItems)
    .innerJoin(books, eq(books.id, readingListItems.bookId))
    .where(eq(readingListItems.listId, listId));

  return { ...list, items };
}

/**
 * Create a new reading list for the user.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT for badge awarding.
 * @param data - List fields: title, optional description, optional isPublic.
 */
export async function createList(
  userId: string,
  schoolId: string,
  data: { title: string; description?: string; isPublic?: boolean },
) {
  const [created] = await db
    .insert(readingLists)
    .values({ userId, title: data.title, description: data.description, isPublic: data.isPublic })
    .returning();

  checkAndAwardBadges(userId, schoolId).catch(() => {}); // non-blocking
  return created!;
}

/**
 * Update a reading list. Verifies ownership.
 * @param listId - The reading list UUID.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT.
 * @param data - Partial update fields.
 */
export async function updateList(
  listId: string,
  userId: string,
  schoolId: string,
  data: { title?: string; description?: string; isPublic?: boolean },
) {
  await assertListOwner(listId, userId, schoolId);

  const [updated] = await db
    .update(readingLists)
    .set(data)
    .where(eq(readingLists.id, listId))
    .returning();

  return updated!;
}

/**
 * Delete a reading list and cascade its items. Verifies ownership.
 * @param listId - The reading list UUID.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT.
 */
export async function deleteList(listId: string, userId: string, schoolId: string) {
  await assertListOwner(listId, userId, schoolId);
  await db.delete(readingLists).where(eq(readingLists.id, listId));
}

/**
 * Add a book to a reading list. Verifies ownership and prevents duplicates.
 * @param listId - The reading list UUID.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT.
 * @param bookId - The book UUID to add.
 * @param status - Initial reading status (defaults to 'to_read').
 */
export async function addBook(
  listId: string,
  userId: string,
  schoolId: string,
  bookId: string,
  status?: 'to_read' | 'reading' | 'completed',
) {
  await assertListOwner(listId, userId, schoolId);

  const [book] = await db.select({ id: books.id }).from(books).where(eq(books.id, bookId)).limit(1);
  if (!book) throw new AppError('BOOK_NOT_FOUND', 'Book not found');

  const [existing] = await db
    .select({ id: readingListItems.id })
    .from(readingListItems)
    .where(and(eq(readingListItems.listId, listId), eq(readingListItems.bookId, bookId)))
    .limit(1);

  if (existing) throw new AppError('BOOK_ALREADY_IN_LIST', 'Book is already in this list');

  const [item] = await db
    .insert(readingListItems)
    .values({ listId, bookId, status: status ?? 'to_read' })
    .returning();

  return item!;
}

/**
 * Update a book item's reading status in a list. Verifies ownership.
 * @param listId - The reading list UUID.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT.
 * @param bookId - The book UUID to update.
 * @param status - New reading status.
 */
export async function updateItemStatus(
  listId: string,
  userId: string,
  schoolId: string,
  bookId: string,
  status: 'to_read' | 'reading' | 'completed',
) {
  await assertListOwner(listId, userId, schoolId);

  const [updated] = await db
    .update(readingListItems)
    .set({ status })
    .where(and(eq(readingListItems.listId, listId), eq(readingListItems.bookId, bookId)))
    .returning();

  if (!updated) throw new AppError('BOOK_NOT_FOUND', 'Book not found in this list');
  return updated;
}

/**
 * Remove a book from a reading list. Verifies ownership.
 * @param listId - The reading list UUID.
 * @param userId - Authenticated user's ID.
 * @param schoolId - School ID from JWT.
 * @param bookId - The book UUID to remove.
 */
export async function removeBook(
  listId: string,
  userId: string,
  schoolId: string,
  bookId: string,
) {
  await assertListOwner(listId, userId, schoolId);

  const [deleted] = await db
    .delete(readingListItems)
    .where(and(eq(readingListItems.listId, listId), eq(readingListItems.bookId, bookId)))
    .returning();

  if (!deleted) throw new AppError('BOOK_NOT_FOUND', 'Book not found in this list');
}
