import { useAuthStore } from '../stores/auth';

/**
 * Returns true if the current user has the given permission
 * (from role floor or granted extra — both are in effectivePermissions).
 */
export function usePermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return user.effectivePermissions?.includes(permission) ?? false;
}
