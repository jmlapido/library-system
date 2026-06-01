import { eq, and, inArray, count, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challenges, challengeProgress } from '../db/schema/engagement.js';
import { checkouts } from '../db/schema/circulation.js';
import { users } from '../db/schema/users.js';
import { AppError } from '../utils/errors.js';
import { checkAndAwardBadges } from './badges.service.js';
import type { Challenge, ChallengeProgress } from '../db/schema/engagement.js';

/** Derive challenge status from start/end dates relative to today. */
function deriveStatus(startDate: string, endDate: string): 'upcoming' | 'active' | 'completed' {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'completed';
  return 'active';
}

/**
 * List all challenges for a school, optionally filtered by status.
 * @param schoolId - Cross-school isolation.
 * @param status - Optional filter: 'upcoming' | 'active' | 'completed'.
 */
export async function listChallenges(
  schoolId: string,
  status?: string,
): Promise<Challenge[]> {
  const conditions = [eq(challenges.schoolId, schoolId)];
  if (status) {
    const validStatuses = ['upcoming', 'active', 'completed'] as const;
    if (validStatuses.includes(status as typeof validStatuses[number])) {
      conditions.push(eq(challenges.status, status as typeof validStatuses[number]));
    }
  }
  return db.select().from(challenges).where(and(...conditions)).orderBy(desc(challenges.createdAt));
}

/**
 * Get a single challenge with enrolled count. Throws CHALLENGE_NOT_FOUND if missing.
 * @param challengeId - Challenge UUID.
 * @param schoolId - Cross-school isolation.
 */
export async function getChallenge(
  challengeId: string,
  schoolId: string,
): Promise<Challenge & { enrolledCount: number }> {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.schoolId, schoolId)))
    .limit(1);

  if (!challenge) throw new AppError('CHALLENGE_NOT_FOUND', 'Challenge not found');

  const [row] = await db
    .select({ total: count(challengeProgress.id) })
    .from(challengeProgress)
    .where(eq(challengeProgress.challengeId, challengeId));

  return { ...challenge, enrolledCount: Number(row?.total ?? 0) };
}

/**
 * Create a new challenge. Status is auto-derived from start/end dates.
 * @param data - Challenge fields.
 * @param _createdBy - Reserved for audit logging.
 */
export async function createChallenge(
  data: {
    schoolId: string;
    title: string;
    description?: string;
    goal: number;
    goalType: 'books' | 'pages' | 'genres';
    startDate: string;
    endDate: string;
  },
  _createdBy: string,
): Promise<Challenge> {
  const status = deriveStatus(data.startDate, data.endDate);
  const [challenge] = await db
    .insert(challenges)
    .values({ ...data, status })
    .returning();
  return challenge!;
}

/**
 * Manually override challenge status. Admin/librarian only.
 * @param challengeId - Challenge UUID.
 * @param schoolId - Cross-school isolation.
 * @param status - New status value.
 */
export async function updateChallengeStatus(
  challengeId: string,
  schoolId: string,
  status: 'upcoming' | 'active' | 'completed',
): Promise<Challenge> {
  const [existing] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.schoolId, schoolId)))
    .limit(1);

  if (!existing) throw new AppError('CHALLENGE_NOT_FOUND', 'Challenge not found');

  const [updated] = await db
    .update(challenges)
    .set({ status })
    .where(eq(challenges.id, challengeId))
    .returning();

  return updated!;
}

/**
 * Delete a challenge. Only allowed if status is 'upcoming'.
 * @param challengeId - Challenge UUID.
 * @param schoolId - Cross-school isolation.
 */
export async function deleteChallenge(challengeId: string, schoolId: string): Promise<void> {
  const [challenge] = await db
    .select({ id: challenges.id, status: challenges.status })
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.schoolId, schoolId)))
    .limit(1);

  if (!challenge) throw new AppError('CHALLENGE_NOT_FOUND', 'Challenge not found');
  if (challenge.status !== 'upcoming') {
    throw new AppError('CHALLENGE_NOT_OPEN', 'Only upcoming challenges can be deleted');
  }

  await db.delete(challengeProgress).where(eq(challengeProgress.challengeId, challengeId));
  await db.delete(challenges).where(eq(challenges.id, challengeId));
}

/**
 * Enroll a student in a challenge. Challenge must be active or upcoming.
 * @param challengeId - Challenge UUID.
 * @param userId - Enrolling user UUID.
 * @param schoolId - Cross-school isolation.
 */
export async function enrollInChallenge(
  challengeId: string,
  userId: string,
  schoolId: string,
): Promise<ChallengeProgress> {
  const [challenge] = await db
    .select({ id: challenges.id, status: challenges.status })
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.schoolId, schoolId)))
    .limit(1);

  if (!challenge) throw new AppError('CHALLENGE_NOT_FOUND', 'Challenge not found');
  if (challenge.status === 'completed') {
    throw new AppError('CHALLENGE_NOT_OPEN', 'Challenge is already completed');
  }

  const [existing] = await db
    .select({ id: challengeProgress.id })
    .from(challengeProgress)
    .where(and(eq(challengeProgress.challengeId, challengeId), eq(challengeProgress.userId, userId)))
    .limit(1);

  if (existing) throw new AppError('ALREADY_ENROLLED', 'Already enrolled in this challenge');

  const [progress] = await db
    .insert(challengeProgress)
    .values({ challengeId, userId, progress: 0, completed: false })
    .returning();

  return progress!;
}

/**
 * Get all challenge enrollments for a user with progress percentage.
 * @param userId - User UUID.
 * @param schoolId - Cross-school isolation.
 */
export async function getMyEnrollments(userId: string, schoolId: string) {
  const rows = await db
    .select({
      id: challengeProgress.id,
      challengeId: challenges.id,
      title: challenges.title,
      description: challenges.description,
      goal: challenges.goal,
      goalType: challenges.goalType,
      startDate: challenges.startDate,
      endDate: challenges.endDate,
      status: challenges.status,
      progress: challengeProgress.progress,
      completed: challengeProgress.completed,
      completedAt: challengeProgress.completedAt,
    })
    .from(challengeProgress)
    .innerJoin(challenges, eq(challenges.id, challengeProgress.challengeId))
    .where(and(eq(challengeProgress.userId, userId), eq(challenges.schoolId, schoolId)));

  return rows.map((r) => ({
    ...r,
    progressPercent: r.goal > 0 ? Math.min(100, Math.round((r.progress / r.goal) * 100)) : 0,
  }));
}

/**
 * Get top 20 leaderboard for a challenge sorted by progress descending.
 * Returns only fullName and progress to avoid PII leakage.
 * @param challengeId - Challenge UUID.
 * @param schoolId - Cross-school isolation.
 */
export async function getChallengeLeaderboard(
  challengeId: string,
  schoolId: string,
): Promise<Array<{ fullName: string; progress: number; completed: boolean }>> {
  const [challenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.schoolId, schoolId)))
    .limit(1);

  if (!challenge) throw new AppError('CHALLENGE_NOT_FOUND', 'Challenge not found');

  const rows = await db
    .select({
      fullName: users.fullName,
      progress: challengeProgress.progress,
      completed: challengeProgress.completed,
    })
    .from(challengeProgress)
    .innerJoin(users, eq(users.id, challengeProgress.userId))
    .where(eq(challengeProgress.challengeId, challengeId))
    .orderBy(desc(challengeProgress.progress))
    .limit(20);

  return rows;
}

/** Count checkouts for a user across all trackable statuses. */
async function countUserCheckouts(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count(checkouts.id) })
    .from(checkouts)
    .where(and(
      eq(checkouts.userId, userId),
      inArray(checkouts.status, ['returned', 'checked_out', 'overdue', 'lost']),
    ));
  return Number(row?.total ?? 0);
}

/**
 * Update progress for all active 'books' challenges a user is enrolled in.
 * Called after a successful checkout. Fire-and-forget safe — never throws.
 * @param userId - User UUID.
 * @param schoolId - School UUID for challenge scope.
 */
export async function updateChallengeProgressOnCheckout(
  userId: string,
  schoolId: string,
): Promise<void> {
  try {
    const activeChallenges = await db
      .select({ id: challenges.id, goal: challenges.goal })
      .from(challenges)
      .where(and(
        eq(challenges.schoolId, schoolId),
        eq(challenges.status, 'active'),
        eq(challenges.goalType, 'books'),
      ));

    if (activeChallenges.length === 0) return;

    const bookCount = await countUserCheckouts(userId);

    for (const challenge of activeChallenges) {
      const [enrollment] = await db
        .select({ id: challengeProgress.id, completed: challengeProgress.completed })
        .from(challengeProgress)
        .where(and(
          eq(challengeProgress.challengeId, challenge.id),
          eq(challengeProgress.userId, userId),
        ))
        .limit(1);

      if (!enrollment) continue;

      const nowCompleted = bookCount >= challenge.goal;
      const wasCompleted = enrollment.completed;

      await db
        .update(challengeProgress)
        .set({
          progress: bookCount,
          ...(nowCompleted && !wasCompleted
            ? { completed: true, completedAt: sql`now()` }
            : {}),
        })
        .where(eq(challengeProgress.id, enrollment.id));

      if (nowCompleted && !wasCompleted) {
        checkAndAwardBadges(userId, schoolId).catch(() => {});
      }
    }
  } catch {
    // fire-and-forget: swallow all errors
  }
}
