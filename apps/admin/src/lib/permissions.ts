/** Every permission that can be granted to a staff member. */
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

export type Permission = (typeof ALL_GRANTABLE_PERMISSIONS)[number];

/**
 * Minimum permissions each role always has.
 * These cannot be revoked — only additional permissions may be granted on top.
 */
export const ROLE_FLOORS: Record<'library_assistant' | 'librarian' | 'admin', readonly Permission[]> = {
  library_assistant: [],
  librarian: ALL_GRANTABLE_PERMISSIONS,
  admin: ALL_GRANTABLE_PERMISSIONS,
};
