import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BottomNav } from './components/BottomNav';
import { LoginPage } from './pages/LoginPage';
import { SearchPage } from './pages/SearchPage';
import { BookDetailPage } from './pages/BookDetailPage';
import { MyBooksPage } from './pages/MyBooksPage';
import { ScanPage } from './pages/ScanPage';
import { AccountPage } from './pages/AccountPage';
import { ReadingListsPage } from './pages/ReadingListsPage';
import { ReadingListDetailPage } from './pages/ReadingListDetailPage';
import { BookClubsPage } from './pages/BookClubsPage';
import { BookClubDetailPage } from './pages/BookClubDetailPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RfidScanPage } from './pages/RfidScanPage';
import { KioskShell } from './kiosk/KioskShell';
import { AttractScreen } from './kiosk/AttractScreen';
import { KioskGuestHome } from './kiosk/KioskGuestHome';
import { KioskSearchPage } from './kiosk/KioskSearchPage';
import { KioskBookDetail } from './kiosk/KioskBookDetail';
import { KioskLoginPage } from './kiosk/KioskLoginPage';
import { KioskCheckoutFlow } from './kiosk/KioskCheckoutFlow';

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

  // ---------- Kiosk route tree (no auth required) ----------
  {
    path: '/kiosk',
    element: <KioskShell />,
    children: [
      { index: true, element: <AttractScreen /> },
      { path: 'home', element: <KioskGuestHome /> },
      { path: 'search', element: <KioskSearchPage /> },
      { path: 'book/:id', element: <KioskBookDetail /> },
      { path: 'login', element: <KioskLoginPage /> },
      { path: 'checkout', element: <KioskCheckoutFlow /> },
    ],
  },

  // ---------- Student portal (auth required) ----------
  {
    element: <ProtectedRoute />,
    children: [
      // Onboarding: full-screen, no bottom nav
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/search" replace /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/book/:id', element: <BookDetailPage /> },
          { path: '/my-books', element: <MyBooksPage /> },
          { path: '/scan', element: <ScanPage /> },
          { path: '/account', element: <AccountPage /> },
          { path: '/reading-lists', element: <ReadingListsPage /> },
          { path: '/reading-lists/:id', element: <ReadingListDetailPage /> },
          { path: '/book-clubs', element: <BookClubsPage /> },
          { path: '/book-clubs/:id', element: <BookClubDetailPage /> },
          { path: '/achievements', element: <AchievementsPage /> },
          { path: '/rfid', element: <RfidScanPage /> },
        ],
      },
    ],
  },
]);
