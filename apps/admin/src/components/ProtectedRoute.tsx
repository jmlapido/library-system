import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface Props {
  roles?: Array<'librarian' | 'library_assistant' | 'admin'>;
  permission?: string;
  children: ReactNode;
}

/**
 * Renders children if authenticated and role/permission check passes.
 * Unauthenticated → /login. Wrong role/permission → /.
 */
export function ProtectedRoute({ roles, permission, children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const roleOk = !roles || (user?.role != null && roles.includes(user.role));
  const permOk = !permission || user?.effectivePermissions.includes(permission);

  if (!roleOk || !permOk) return <Navigate to="/" replace />;

  return <>{children}</>;
}
