import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { useAuthStore } from './stores/auth';

function RoleRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'admin') return <Navigate to="/staff-management" replace />;
  return <Navigate to="/circulation" replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <ProtectedRoute roles={['librarian', 'library_assistant', 'admin']}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <RoleRedirect /> },
      {
        path: '/staff-management',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']}>
            <div className="p-6 text-muted-foreground">Staff Management — loading…</div>
          </ProtectedRoute>
        ),
      },
      {
        path: '/audit-log',
        element: (
          <ProtectedRoute roles={['admin']}>
            <div className="p-6 text-muted-foreground">Audit Log — coming in Task 35</div>
          </ProtectedRoute>
        ),
      },
      { path: '/circulation', element: <div className="p-6 text-muted-foreground">Circulation — coming in Task 32</div> },
      { path: '/shelving-queue', element: <div className="p-6 text-muted-foreground">Shelving Queue — coming in Task 32</div> },
      {
        path: '/catalog',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']} permission="catalog.view">
            <div className="p-6 text-muted-foreground">Catalog — coming in Task 33</div>
          </ProtectedRoute>
        ),
      },
      {
        path: '/students',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']} permission="students.view">
            <div className="p-6 text-muted-foreground">Students — coming in Task 34</div>
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
