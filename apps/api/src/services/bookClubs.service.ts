import { eq, and, count, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookClubs, bookClubMembers } from '../db/schema/bookClubs.js';
import { books } from '../db/schema/books.js';
import { users } from '../db/schema/users.js';
import { AppError } from '../utils/errors.js';
import { checkAndAwardBadges } from './badges.service.js';

type ClubStatus = 'planning' | 'active' | 'completed' | 'cancelled';

/** Assert the club exists and belongs to the school. Returns the club row. */
async function assertClubExists(clubId: string, schoolId: string) {
  const [club] = await db
    .select()
    .from(bookClubs)
    .where(and(eq(bookClubs.id, clubId), eq(bookClubs.schoolId, schoolId)))
    .limit(1);
  if (!club) throw new AppError('CLUB_NOT_FOUND', 'Book club not found');
  return club;
}

/** Assert the user is the organizer or has admin/librarian role (not checked here — caller decides). */
async function assertClubOrganizer(clubId: string, userId: string, schoolId: string) {
  const club = await assertClubExists(clubId, schoolId);
  if (club.organizerId !== userId) throw new AppError('CLUB_ACCESS_DENIED', 'Only the organizer can perform this action');
  return club;
}

/**
 * List all clubs for a school with optional status filter and member count.
 * @param schoolId - School ID from JWT.
 * @param filters - Optional status filter.
 */
export async function listClubs(schoolId: string, filters?: { status?: ClubStatus }) {
  const conditions = [eq(bookClubs.schoolId, schoolId)];
  if (filters?.status) conditions.push(eq(bookClubs.status, filters.status));

  const rows = await db
    .select({
      id: bookClubs.id,
      name: bookClubs.name,
      description: bookClubs.description,
      bookId: bookClubs.bookId,
      organizerId: bookClubs.organizerId,
      startDate: bookClubs.startDate,
      endDate: bookClubs.endDate,
      maxMembers: bookClubs.maxMembers,
      status: bookClubs.status,
      createdAt: bookClubs.createdAt,
      memberCount: count(bookClubMembers.id),
    })
    .from(bookClubs)
    .leftJoin(bookClubMembers, eq(bookClubMembers.clubId, bookClubs.id))
    .where(and(...conditions))
    .groupBy(bookClubs.id);

  return rows;
}

/**
 * Get a single club with member count and book details.
 * @param clubId - The club UUID.
 * @param schoolId - School ID from JWT.
 */
export async function getClub(clubId: string, schoolId: string) {
  const club = await assertClubExists(clubId, schoolId);

  const [memberCount] = await db
    .select({ count: count(bookClubMembers.id) })
    .from(bookClubMembers)
    .where(eq(bookClubMembers.clubId, clubId));

  let bookDetails = null;
  if (club.bookId) {
    const [book] = await db
      .select({ id: books.id, title: books.title, author: books.author, coverUrl: books.coverUrl })
      .from(books)
      .where(eq(books.id, club.bookId))
      .limit(1);
    bookDetails = book ?? null;
  }

  return { ...club, memberCount: memberCount?.count ?? 0, book: bookDetails };
}

/**
 * Create a new book club. Auto-joins organizer as 'organizer' member.
 * @param data - Club fields including schoolId.
 * @param organizerId - ID of the user creating the club.
 */
export async function createClub(
  data: { schoolId: string; name: string; description?: string; bookId?: string; startDate?: string; endDate?: string; maxMembers?: number },
  organizerId: string,
) {
  const [club] = await db
    .insert(bookClubs)
    .values({ ...data, organizerId })
    .returning();

  await db.insert(bookClubMembers).values({ clubId: club!.id, userId: organizerId, role: 'organizer' });
  return club!;
}

/**
 * Update a club. Organizer only.
 * @param clubId - The club UUID.
 * @param userId - Authenticated user ID.
 * @param data - Partial update fields.
 */
export async function updateClub(
  clubId: string,
  userId: string,
  data: { name?: string; description?: string; bookId?: string; startDate?: string; endDate?: string; maxMembers?: number; status?: ClubStatus },
) {
  const club = await db
    .select({ id: bookClubs.id, organizerId: bookClubs.organizerId, schoolId: bookClubs.schoolId })
    .from(bookClubs)
    .where(eq(bookClubs.id, clubId))
    .limit(1)
    .then((r) => r[0]);

  if (!club) throw new AppError('CLUB_NOT_FOUND', 'Book club not found');
  if (club.organizerId !== userId) throw new AppError('CLUB_ACCESS_DENIED', 'Only the organizer can update this club');

  const [updated] = await db.update(bookClubs).set(data).where(eq(bookClubs.id, clubId)).returning();
  return updated!;
}

/**
 * Delete a club. Organizer only. Club must be in 'planning' status.
 * @param clubId - The club UUID.
 * @param userId - Authenticated user ID.
 * @param schoolId - School ID from JWT.
 */
export async function deleteClub(clubId: string, userId: string, schoolId: string) {
  const club = await assertClubOrganizer(clubId, userId, schoolId);
  if (club.status !== 'planning') throw new AppError('CANNOT_DELETE_ACTIVE_CLUB', 'Only planning clubs can be deleted');
  await db.delete(bookClubs).where(eq(bookClubs.id, clubId));
}

/**
 * Join a club as a member. Checks capacity, membership, and joinable status.
 * @param clubId - The club UUID.
 * @param userId - The user joining.
 * @param schoolId - School ID from JWT.
 */
export async function joinClub(clubId: string, userId: string, schoolId: string) {
  const club = await assertClubExists(clubId, schoolId);

  if (club.status !== 'active' && club.status !== 'planning') {
    throw new AppError('CLUB_NOT_JOINABLE', 'Club is not open for new members');
  }

  const [existing] = await db
    .select({ id: bookClubMembers.id })
    .from(bookClubMembers)
    .where(and(eq(bookClubMembers.clubId, clubId), eq(bookClubMembers.userId, userId)))
    .limit(1);
  if (existing) throw new AppError('ALREADY_A_MEMBER', 'You are already a member of this club');

  if (club.maxMembers !== null && club.maxMembers !== undefined) {
    const countRows = await db
      .select({ total: count(bookClubMembers.id) })
      .from(bookClubMembers)
      .where(eq(bookClubMembers.clubId, clubId));
    const current = countRows[0]?.total ?? 0;
    if (Number(current) >= club.maxMembers) throw new AppError('CLUB_FULL', 'Club has reached its maximum member capacity');
  }

  const [member] = await db.insert(bookClubMembers).values({ clubId, userId, role: 'member' }).returning();
  checkAndAwardBadges(userId, club.schoolId).catch(() => {}); // non-blocking
  return member!;
}

/**
 * Leave a club. Organizer cannot leave — must transfer or delete.
 * @param clubId - The club UUID.
 * @param userId - The user leaving.
 */
export async function leaveClub(clubId: string, userId: string) {
  const [membership] = await db
    .select({ id: bookClubMembers.id, role: bookClubMembers.role })
    .from(bookClubMembers)
    .where(and(eq(bookClubMembers.clubId, clubId), eq(bookClubMembers.userId, userId)))
    .limit(1);

  if (!membership) throw new AppError('CLUB_NOT_FOUND', 'You are not a member of this club');
  if (membership.role === 'organizer') throw new AppError('ORGANIZER_CANNOT_LEAVE', 'Organizer cannot leave — transfer ownership or delete the club');

  await db.delete(bookClubMembers).where(eq(bookClubMembers.id, membership.id));
}

/**
 * Get all clubs the user is a member of.
 * @param userId - Authenticated user ID.
 * @param schoolId - School ID from JWT.
 */
export async function getMyClubs(userId: string, schoolId: string) {
  const rows = await db
    .select({
      id: bookClubs.id,
      name: bookClubs.name,
      description: bookClubs.description,
      status: bookClubs.status,
      role: bookClubMembers.role,
      joinedAt: bookClubMembers.joinedAt,
      createdAt: bookClubs.createdAt,
    })
    .from(bookClubMembers)
    .innerJoin(bookClubs, eq(bookClubs.id, bookClubMembers.clubId))
    .where(and(eq(bookClubMembers.userId, userId), eq(bookClubs.schoolId, schoolId)));

  return rows;
}

/**
 * Get all members of a club with user info.
 * @param clubId - The club UUID.
 * @param schoolId - School ID from JWT.
 */
export async function getClubMembers(clubId: string, schoolId: string) {
  await assertClubExists(clubId, schoolId);

  const members = await db
    .select({
      id: bookClubMembers.id,
      userId: bookClubMembers.userId,
      role: bookClubMembers.role,
      joinedAt: bookClubMembers.joinedAt,
      fullName: users.fullName,
      gradeLevel: users.gradeLevel,
    })
    .from(bookClubMembers)
    .innerJoin(users, eq(users.id, bookClubMembers.userId))
    .where(eq(bookClubMembers.clubId, clubId));

  return members;
}
