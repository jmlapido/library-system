import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BottomNav } from './components/BottomNav';
import { LoginPage } from './pages/LoginPage';
import { SearchPage } from './pages/SearchPage';
import { BookDetailPage } from './pages/BookDetailPage';
import { MyBooksPage } from './pages/MyBooksPage';
import { ScanPage } from './pages/ScanPage';
import { AccountPage } from './pages/AccountPage';

/** Authenticated layout wrapper: gradient background + fixed bottom nav. */
function AppShell() {
  return (
    <div
      style={{
        paddingBottom: 64,
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        minWidth: 0,
      }}
    >
      <Outlet />
      <BottomNav />
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/search" replace /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/book/:id', element: <BookDetailPage /> },
          { path: '/my-books', element: <MyBooksPage /> },
          { path: '/scan', element: <ScanPage /> },
          { path: '/account', element: <AccountPage /> },
        ],
      },
    ],
  },
]);
