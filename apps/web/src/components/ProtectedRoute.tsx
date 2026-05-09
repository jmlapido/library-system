import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

/** Redirects unauthenticated users to /login; renders child routes otherwise. */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.accessToken !== null);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
