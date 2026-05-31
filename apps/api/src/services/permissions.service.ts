import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userPermissions, users } from '../db/schema/index.js';
import { AppError } from '../utils/errors.js';

export const ALL_GRANTABLE_PERMISSIONS = [
  'catalog.view',
  'catalog.create',
  'catalog.edit',
  'catalog.archive',
  'catalog.manage_copies',
  'students.view',
  'students.reset_pin',
  'students.edit_email',
  'staff.view',
  'staff.approve',
  'staff.reject',
] as const;

const ROLE_FLOORS: Record<string, string[]> = {
  library_assistant: [],
  librarian: [...ALL_GRANTABLE_PERMISSIONS],
  admin: [...ALL_GRANTABLE_PERMISSIONS],
};

/**
 * Returns the effective permissions: role floor + granted extras, deduped.
 * @param userId - The user's UUID.
 * @param role - The user's current role string.
 */
export async function getEffectivePermissions(userId: string, role: string): Promise<string[]> {
  const floor = ROLE_FLOORS[role] ?? [];
  const granted = await db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return Array.from(new Set([...floor, ...granted.map((r) => r.permission)]));
}

/**
 * Returns only the extras granted to the user (not the role floor).
 * @param userId - The user's UUID.
 */
export async function getUserGrantedPermissions(userId: string): Promise<string[]> {
  const rows = await db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return rows.map((r) => r.permission);
}

/**
 * Replaces all granted extras for the user with the provided list.
 * Unknown permission strings are silently filtered out.
 * @param userId - Target user's UUID.
 * @param permissions - New set of permission strings to grant.
 * @param adminId - UUID of the admin performing the action.
 * @throws AppError USER_NOT_FOUND if the target user does not exist.
 */
export async function setUserPermissions(
  userId: string,
  permissions: string[],
  adminId: string,
): Promise<void> {
  const valid = permissions.filter((p) =>
    (ALL_GRANTABLE_PERMISSIONS as readonly string[]).includes(p),
  );

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError('USER_NOT_FOUND', 'User not found');

  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));

  if (valid.length > 0) {
    await db.insert(userPermissions).values(
      valid.map((permission) => ({ userId, permission, grantedBy: adminId })),
    );
  }
}
