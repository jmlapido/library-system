import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { holds } from '../db/schema/circulation.js';
import { users } from '../db/schema/users.js';
import { AppError } from '../utils/errors.js';

/**
 * Manually expire a single hold by ID.
 * Verifies the hold belongs to the given school and is in a pending state.
 * Throws HOLD_NOT_FOUND if missing or from another school.
 * Throws HOLD_NOT_PENDING if already fulfilled, cancelled, or expired.
 */
export async function manualExpireHold(holdId: string, schoolId: string): Promise<void> {
  const [row] = await db
    .select({ id: holds.id, status: holds.status, userSchoolId: users.schoolId })
    .from(holds)
    .innerJoin(users, eq(holds.userId, users.id))
    .where(and(eq(holds.id, holdId), eq(users.schoolId, schoolId)))
    .limit(1);

  if (!row) {
    throw new AppError('HOLD_NOT_FOUND', 'Hold not found');
  }

  if (row.status !== 'pending') {
    throw new AppError('HOLD_NOT_PENDING', `Hold is already '${row.status}'`);
  }

  await db
    .update(holds)
    .set({ status: 'expired' })
    .where(eq(holds.id, holdId));
}
