import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { StaffManagementPage } from './features/staff-management/StaffManagementPage';
import { CirculationPage } from './features/circulation/CirculationPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { BulkImportPage } from './features/bulk-import/BulkImportPage';
import { SchoolSettingsPage } from './features/settings/SchoolSettingsPage';
import { useAuthStore } from './stores/auth';

function RoleRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'admin') return <Navigate to="/staff-management" replace />;
  return <Navigate to="/circulation" replace />;
}

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
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
            <StaffManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']}>
            <ReportsPage />
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
      {
        path: '/circulation',
        element: (
          <ProtectedRoute roles={['librarian', 'library_assistant', 'admin']}>
            <CirculationPage />
          </ProtectedRoute>
        ),
      },
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
      {
        path: '/bulk-import',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']}>
            <BulkImportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute roles={['admin']}>
            <SchoolSettingsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
