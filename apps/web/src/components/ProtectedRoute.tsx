import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

/** Redirects unauthenticated users to /login; sends new students to /onboarding on first login. */
export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!accessToken) return <Navigate to="/login" replace />;

  const needsOnboarding =
    user?.role === 'student' &&
    (user?.interests?.length ?? 0) === 0 &&
    location.pathname !== '/onboarding';

  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
