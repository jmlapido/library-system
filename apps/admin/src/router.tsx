import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { StaffManagementPage } from './features/staff-management/StaffManagementPage';
import { CirculationPage } from './features/circulation/CirculationPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { BulkImportPage } from './features/bulk-import/BulkImportPage';
import { SchoolSettingsPage } from './features/settings/SchoolSettingsPage';
import { WebhooksPage } from './features/webhooks/WebhooksPage';
import { OAuthCallbackPage } from './features/auth/OAuthCallbackPage';
import { SchoolsManagementPage } from './features/schools/SchoolsManagementPage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { StudentsPage } from './features/students/StudentsPage';
import { ShelvingQueuePage } from './features/shelving/ShelvingQueuePage';
import { AuditLogPage } from './features/audit-log/AuditLogPage';
import { useAuthStore } from './stores/auth';

function RoleRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'super_admin') return <Navigate to="/schools" replace />;
  return <Navigate to="/dashboard" replace />;
}

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/oauth-callback', element: <OAuthCallbackPage /> },
  {
    element: (
      <ProtectedRoute roles={['librarian', 'library_assistant', 'admin', 'super_admin']}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <RoleRedirect /> },
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute roles={['librarian', 'library_assistant', 'admin']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
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
            <AuditLogPage />
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
      {
        path: '/shelving-queue',
        element: (
          <ProtectedRoute roles={['librarian', 'library_assistant', 'admin']}>
            <ShelvingQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/catalog',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']} permission="catalog.view">
            <CatalogPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/students',
        element: (
          <ProtectedRoute roles={['librarian', 'admin']} permission="students.view">
            <StudentsPage />
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
      {
        path: '/webhooks',
        element: (
          <ProtectedRoute roles={['admin']}>
            <WebhooksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/schools',
        element: (
          <ProtectedRoute roles={['super_admin']}>
            <SchoolsManagementPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
