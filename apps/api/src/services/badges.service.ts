import { eq, and, inArray, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { badges, userBadges } from '../db/schema/engagement.js';
import { checkouts } from '../db/schema/circulation.js';
import { bookClubMembers } from '../db/schema/bookClubs.js';
import { challengeProgress } from '../db/schema/engagement.js';
import { readingLists } from '../db/schema/readingLists.js';
import { AppError } from '../utils/errors.js';
import type { Badge } from '../db/schema/engagement.js';

const CRITERIA_BOOKS_READ = ['books_read_1', 'books_read_5', 'books_read_10', 'books_read_25'] as const;
const CRITERIA_THRESHOLDS: Record<string, number> = {
  books_read_1: 1,
  books_read_5: 5,
  books_read_10: 10,
  books_read_25: 25,
};

const DEFAULT_BADGE_DEFS = [
  { name: 'First Book', description: 'Checked out your first book', criteria: 'books_read_1' },
  { name: 'Bookworm', description: 'Checked out 5 books', criteria: 'books_read_5' },
  { name: 'Avid Reader', description: 'Checked out 10 books', criteria: 'books_read_10' },
  { name: 'Scholar', description: 'Checked out 25 books', criteria: 'books_read_25' },
  { name: 'Club Member', description: 'Joined your first book club', criteria: 'club_joined' },
  { name: 'Champion', description: 'Completed a reading challenge', criteria: 'challenge_completed' },
  { name: 'Curator', description: 'Created your first reading list', criteria: 'reading_list_created' },
] as const;

/**
 * List all badges for a school.
 * @param schoolId - School ID for cross-school isolation.
 */
export async function listBadges(schoolId: string): Promise<Badge[]> {
  return db.select().from(badges).where(eq(badges.schoolId, schoolId));
}

/**
 * Create a badge for a school.
 * @param data - Badge fields including schoolId, name, and optional fields.
 */
export async function createBadge(data: {
  schoolId: string;
  name: string;
  description?: string;
  iconUrl?: string;
  criteria?: string;
}): Promise<Badge> {
  const [badge] = await db.insert(badges).values(data).returning();
  return badge!;
}

/**
 * Delete a badge. Fails if any user_badges exist for it.
 * @param badgeId - The badge UUID.
 * @param schoolId - Must match badge's school for isolation.
 */
export async function deleteBadge(badgeId: string, schoolId: string): Promise<void> {
  const [badge] = await db
    .select({ id: badges.id })
    .from(badges)
    .where(and(eq(badges.id, badgeId), eq(badges.schoolId, schoolId)))
    .limit(1);

  if (!badge) throw new AppError('BADGE_NOT_FOUND', 'Badge not found');

  const [earned] = await db
    .select({ count: count(userBadges.id) })
    .from(userBadges)
    .where(eq(userBadges.badgeId, badgeId));

  if ((earned?.count ?? 0) > 0) {
    throw new AppError('BADGE_IN_USE', 'Cannot delete badge — it has already been awarded to students');
  }

  await db.delete(badges).where(eq(badges.id, badgeId));
}

/** Count checkout rows for a user across trackable statuses. */
async function countCheckouts(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count(checkouts.id) })
    .from(checkouts)
    .where(and(
      eq(checkouts.userId, userId),
      inArray(checkouts.status, ['returned', 'checked_out', 'overdue', 'lost']),
    ));
  return Number(row?.total ?? 0);
}

/** Evaluate whether a single criteria string is met for a user. */
async function evaluateCriteria(criteria: string, userId: string): Promise<boolean> {
  if (CRITERIA_BOOKS_READ.includes(criteria as typeof CRITERIA_BOOKS_READ[number])) {
    const threshold = CRITERIA_THRESHOLDS[criteria]!;
    const total = await countCheckouts(userId);
    return total >= threshold;
  }

  if (criteria === 'club_joined') {
    const [row] = await db
      .select({ total: count(bookClubMembers.id) })
      .from(bookClubMembers)
      .where(eq(bookClubMembers.userId, userId));
    return Number(row?.total ?? 0) >= 1;
  }

  if (criteria === 'challenge_completed') {
    const [row] = await db
      .select({ total: count(challengeProgress.id) })
      .from(challengeProgress)
      .where(and(eq(challengeProgress.userId, userId), eq(challengeProgress.completed, true)));
    return Number(row?.total ?? 0) >= 1;
  }

  if (criteria === 'reading_list_created') {
    const [row] = await db
      .select({ total: count(readingLists.id) })
      .from(readingLists)
      .where(eq(readingLists.userId, userId));
    return Number(row?.total ?? 0) >= 1;
  }

  return false;
}

/**
 * Check all criteria for a user and award any unearned badges.
 * Called after events: checkout, club join, challenge complete, list create.
 * Returns newly awarded badges (for notification purposes).
 * @param userId - The user to check badges for.
 * @param schoolId - School ID for cross-school isolation.
 */
export async function checkAndAwardBadges(userId: string, schoolId: string): Promise<Badge[]> {
  const allBadges = await db
    .select()
    .from(badges)
    .where(and(eq(badges.schoolId, schoolId)));

  const criteriaOnlyBadges = allBadges.filter((b) => b.criteria !== null);
  if (criteriaOnlyBadges.length === 0) return [];

  const earnedRows = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const earnedIds = new Set(earnedRows.map((r) => r.badgeId));

  const unearnedBadges = criteriaOnlyBadges.filter((b) => !earnedIds.has(b.id));
  if (unearnedBadges.length === 0) return [];

  const newlyAwarded: Badge[] = [];

  for (const badge of unearnedBadges) {
    const met = await evaluateCriteria(badge.criteria!, userId);
    if (met) {
      await db.insert(userBadges).values({ userId, badgeId: badge.id }).onConflictDoNothing();
      newlyAwarded.push(badge);
    }
  }

  return newlyAwarded;
}

/**
 * Get all badges earned by a user, joined with badge details.
 * @param userId - The user whose badges to retrieve.
 * @param schoolId - School ID for cross-school isolation.
 */
export async function getMyBadges(userId: string, schoolId: string) {
  const rows = await db
    .select({
      id: userBadges.id,
      earnedAt: userBadges.earnedAt,
      badgeId: badges.id,
      name: badges.name,
      description: badges.description,
      iconUrl: badges.iconUrl,
      criteria: badges.criteria,
    })
    .from(userBadges)
    .innerJoin(badges, eq(badges.id, userBadges.badgeId))
    .where(and(eq(userBadges.userId, userId), eq(badges.schoolId, schoolId)));

  return rows;
}

/**
 * Seed default badges for a school if they don't already exist.
 * Creates 7 default badge definitions covering all criteria strings.
 * @param schoolId - The school to seed badges for.
 */
export async function seedDefaultBadges(schoolId: string): Promise<Badge[]> {
  const existing = await db
    .select({ criteria: badges.criteria })
    .from(badges)
    .where(eq(badges.schoolId, schoolId));

  const existingCriteria = new Set(existing.map((b) => b.criteria));
  const toInsert = DEFAULT_BADGE_DEFS.filter((def) => !existingCriteria.has(def.criteria));

  if (toInsert.length === 0) return [];

  const inserted = await db
    .insert(badges)
    .values(toInsert.map((def) => ({ ...def, schoolId })))
    .returning();

  return inserted;
}
