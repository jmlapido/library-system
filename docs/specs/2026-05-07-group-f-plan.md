# Group F — Student Web Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the student-facing `apps/web` React SPA — login, catalog search, book detail, my books, barcode scanner, and PWA offline support.

**Architecture:** React Router v6 SPA with a bottom tab bar shell. Zustand persists the auth session. All API calls go through a typed fetch wrapper that auto-refreshes the access token on 401. Vite PWA plugin generates the service worker.

**Tech Stack:** React 18, Vite, React Router v6, Zustand v5, Framer Motion, react-i18next, Quagga2, idb, vite-plugin-pwa, Vitest + @testing-library/react

---

## File Map

```
apps/web/
├── public/
│   └── manifest.json                   (Task 12 — PWA manifest)
├── src/
│   ├── lib/
│   │   ├── api.ts                      (Task 2 — typed fetch client)
│   │   └── catalog-cache.ts            (Task 12 — IndexedDB snapshot)
│   ├── stores/
│   │   └── auth.ts                     (Task 2 — Zustand auth store)
│   ├── router.tsx                      (Task 3 — route definitions)
│   ├── components/
│   │   ├── BottomNav.tsx               (Task 3)
│   │   ├── ProtectedRoute.tsx          (Task 3)
│   │   ├── StatusBadge.tsx             (Task 5)
│   │   ├── BookCard.tsx                (Task 5)
│   │   ├── GenreChips.tsx              (Task 5)
│   │   └── SkeletonCard.tsx            (Task 5)
│   ├── pages/
│   │   ├── LoginPage.tsx               (Task 6)
│   │   ├── SearchPage.tsx              (Task 7)
│   │   ├── BookDetailPage.tsx          (Task 8)
│   │   ├── MyBooksPage.tsx             (Task 9)
│   │   ├── ScanPage.tsx                (Task 11)
│   │   └── AccountPage.tsx             (Task 10)
│   ├── i18n/
│   │   ├── index.ts                    (Task 4)
│   │   ├── en.json                     (Task 4)
│   │   └── tl.json                     (Task 4)
│   ├── App.tsx                         (Task 3 — updated)
│   └── main.tsx                        (Task 4 — updated with i18n)
├── vite.config.ts                      (Task 1 + Task 12 — updated)
└── package.json                        (Task 1 — updated)
```

---

## Task 1: Branch + Install Dependencies

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 1: Create feature branch**

```bash
cd librams
git checkout -b feat/group-f-student-portal
```

- [ ] **Step 2: Install runtime dependencies**

```bash
cd apps/web
pnpm add react-router-dom quagga2 idb workbox-window
```

- [ ] **Step 3: Install dev dependencies**

```bash
pnpm add -D vite-plugin-pwa vitest @testing-library/react @testing-library/user-event @vitejs/plugin-react jsdom
```

- [ ] **Step 4: Update `vite.config.ts` with test config**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 5: Create test setup file**

Create `apps/web/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Add `@testing-library/jest-dom` types**

```bash
pnpm add -D @testing-library/jest-dom
```

Update `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Add test script to `apps/web/package.json`**

Add to the `scripts` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Commit**

```bash
cd ../..
git add apps/web/package.json apps/web/vite.config.ts apps/web/tsconfig.json apps/web/src/test-setup.ts
git commit -m "chore(web): install deps + vitest setup for Group F"
```

---

## Task 2: API Client + Auth Store

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/stores/auth.ts`
- Create: `apps/web/src/stores/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing test for auth store**

Create `apps/web/src/stores/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth';

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('stores tokens and user on login', () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: '1', name: 'Maria', role: 'student', studentId: '2024-001', gradeLevel: 'Grade 9' },
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('tok');
  });

  it('clears session on logout', () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: '1', name: 'Maria', role: 'student', studentId: '2024-001', gradeLevel: 'Grade 9' },
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — "cannot find module '../auth'"

- [ ] **Step 3: Create `src/stores/auth.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  name: string;
  role: string;
  studentId: string | null;
  gradeLevel: string | null;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: () => boolean;
  setSession: (session: AuthSession) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: () => get().accessToken !== null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setAccessToken: (token) => set({ accessToken: token }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'librams-auth' }
  )
);
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 5: Create `src/lib/api.ts`**

```typescript
import { useAuthStore } from '../stores/auth';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const { refreshToken, setAccessToken, logout } = useAuthStore.getState();
    if (!refreshToken) { logout(); throw new ApiError(401, 'NO_REFRESH_TOKEN', 'Not authenticated'); }
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { logout(); throw new ApiError(401, 'REFRESH_FAILED', 'Session expired'); }
    const json = await res.json() as { data: { accessToken: string } };
    setAccessToken(json.data.accessToken);
    return json.data.accessToken;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    headers['Authorization'] = `Bearer ${newToken}`;
    return request<T>(path, { ...init, headers }, false);
  }

  const json = await res.json() as { success: boolean; data?: T; error?: string; code?: string };
  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.code ?? 'UNKNOWN', json.error ?? 'Request failed');
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/web/src/stores apps/web/src/lib/api.ts
git commit -m "feat(web): api client + auth store"
```

---

## Task 3: Router + App Shell

**Files:**
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/components/BottomNav.tsx`
- Create: `apps/web/src/components/ProtectedRoute.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write failing test for BottomNav**

Create `apps/web/src/components/__tests__/BottomNav.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '../BottomNav';

describe('BottomNav', () => {
  it('renders four tabs', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('My Books')).toBeInTheDocument();
    expect(screen.getByText('Scan')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — "cannot find module '../BottomNav'"

- [ ] **Step 3: Create `src/components/BottomNav.tsx`**

```typescript
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/search', icon: '🔍', label: 'Search' },
  { to: '/my-books', icon: '📖', label: 'My Books' },
  { to: '/scan', icon: '📷', label: 'Scan' },
  { to: '/account', icon: '👤', label: 'Account' },
] as const;

export function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#3730a3',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      zIndex: 100,
    }}>
      {tabs.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0 12px',
            textDecoration: 'none',
            color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
            fontSize: 10,
            gap: 2,
          })}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create `src/components/ProtectedRoute.tsx`**

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 5: Create `src/router.tsx`**

```typescript
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SearchPage } from './pages/SearchPage';
import { BookDetailPage } from './pages/BookDetailPage';
import { MyBooksPage } from './pages/MyBooksPage';
import { ScanPage } from './pages/ScanPage';
import { AccountPage } from './pages/AccountPage';
import { BottomNav } from './components/BottomNav';

function AppShell() {
  return (
    <div style={{ paddingBottom: 64, minHeight: '100vh', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', minWidth: 0 }}>
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
```

- [ ] **Step 6: Update `src/App.tsx`**

```typescript
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

export default function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 7: Create stub pages so router compiles**

Create each stub (repeat pattern for all 6):

`src/pages/LoginPage.tsx`:
```typescript
export function LoginPage() { return <div>Login</div>; }
```

`src/pages/SearchPage.tsx`:
```typescript
export function SearchPage() { return <div>Search</div>; }
```

`src/pages/BookDetailPage.tsx`:
```typescript
export function BookDetailPage() { return <div>Book Detail</div>; }
```

`src/pages/MyBooksPage.tsx`:
```typescript
export function MyBooksPage() { return <div>My Books</div>; }
```

`src/pages/ScanPage.tsx`:
```typescript
export function ScanPage() { return <div>Scan</div>; }
```

`src/pages/AccountPage.tsx`:
```typescript
export function AccountPage() { return <div>Account</div>; }
```

- [ ] **Step 8: Run tests**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 9: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 10: Commit**

```bash
cd ../..
git add apps/web/src/router.tsx apps/web/src/App.tsx apps/web/src/components apps/web/src/pages
git commit -m "feat(web): router + app shell + bottom nav"
```

---

## Task 4: i18n Setup

**Files:**
- Create: `apps/web/src/i18n/en.json`
- Create: `apps/web/src/i18n/tl.json`
- Create: `apps/web/src/i18n/index.ts`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Create `src/i18n/en.json`**

```json
{
  "nav": {
    "search": "Search",
    "myBooks": "My Books",
    "scan": "Scan",
    "account": "Account"
  },
  "login": {
    "title": "LibraMS",
    "subtitle": "Welcome back",
    "identifier": "Email or Student ID",
    "password": "Password",
    "pin": "PIN",
    "detectedEmail": "Email detected",
    "detectedStudentId": "Student ID detected",
    "submit": "Sign In",
    "error": "Invalid credentials. Please try again."
  },
  "search": {
    "placeholder": "Search books, authors, ISBN...",
    "allGenres": "All",
    "noResults": "No books found. Try different keywords.",
    "available": "Available",
    "checkedOut": "Checked out",
    "onHold": "On hold"
  },
  "book": {
    "about": "About",
    "copies": "Copies",
    "related": "Related",
    "checkout": "Checkout",
    "placeHold": "Place Hold",
    "cancelHold": "Cancel Hold",
    "copiesAvailable": "{{available}} of {{total}} copies available",
    "confirmCheckout": "Confirm Checkout",
    "dueDate": "Due date: {{date}}",
    "holdPlaced": "Hold placed — you are #{{position}} in line",
    "noDescription": "No description available."
  },
  "myBooks": {
    "checkedOut": "Checked Out",
    "holds": "Holds",
    "renew": "Renew",
    "cancelHold": "Cancel Hold",
    "noCheckouts": "No books checked out — explore the catalog!",
    "noHolds": "No holds placed.",
    "dueIn": "Due in {{days}} days",
    "dueToday": "Due today",
    "overdue": "Overdue by {{days}} days",
    "holdReady": "Ready — pick up by {{date}}",
    "queuePosition": "You are #{{position}} in line"
  },
  "account": {
    "language": "Language",
    "signOut": "Sign Out",
    "booksThisYear": "Books this year",
    "gradeLevel": "Grade Level"
  },
  "scan": {
    "instruction": "Point at barcode",
    "enterManually": "Enter manually",
    "notFound": "Barcode not recognized",
    "permissionDenied": "Camera access denied. Use manual entry.",
    "manualPlaceholder": "Enter ISBN or barcode..."
  }
}
```

- [ ] **Step 2: Create `src/i18n/tl.json`**

```json
{
  "nav": {
    "search": "Hanapin",
    "myBooks": "Aking Libro",
    "scan": "I-scan",
    "account": "Account"
  },
  "login": {
    "title": "LibraMS",
    "subtitle": "Maligayang pagbabalik",
    "identifier": "Email o Student ID",
    "password": "Password",
    "pin": "PIN",
    "detectedEmail": "Email ang natukoy",
    "detectedStudentId": "Student ID ang natukoy",
    "submit": "Mag-sign In",
    "error": "Mali ang credentials. Subukan ulit."
  },
  "search": {
    "placeholder": "Maghanap ng libro, may-akda, ISBN...",
    "allGenres": "Lahat",
    "noResults": "Walang nahanap na libro. Subukan ng iba.",
    "available": "Available",
    "checkedOut": "Hiniram na",
    "onHold": "Naghihintay"
  },
  "book": {
    "about": "Tungkol",
    "copies": "Kopya",
    "related": "Kaugnay",
    "checkout": "Hiramin",
    "placeHold": "Mag-hold",
    "cancelHold": "Kanselahin ang Hold",
    "copiesAvailable": "{{available}} sa {{total}} kopya ang available",
    "confirmCheckout": "Kumpirmahin ang Pahiram",
    "dueDate": "Petsa ng pagbabalik: {{date}}",
    "holdPlaced": "Naka-hold na — ikaw ay #{{position}} sa pila",
    "noDescription": "Walang paglalarawan."
  },
  "myBooks": {
    "checkedOut": "Hiniram",
    "holds": "Mga Hold",
    "renew": "I-renew",
    "cancelHold": "Kanselahin",
    "noCheckouts": "Walang hiniram na libro — mag-browse ng catalog!",
    "noHolds": "Walang mga hold.",
    "dueIn": "Due sa loob ng {{days}} araw",
    "dueToday": "Due ngayon",
    "overdue": "Overdue ng {{days}} araw",
    "holdReady": "Handa na — kunin bago {{date}}",
    "queuePosition": "Ikaw ay #{{position}} sa pila"
  },
  "account": {
    "language": "Wika",
    "signOut": "Mag-sign Out",
    "booksThisYear": "Libro ngayong taon",
    "gradeLevel": "Antas"
  },
  "scan": {
    "instruction": "Ituro sa barcode",
    "enterManually": "Ilagay nang manu-mano",
    "notFound": "Hindi nakilala ang barcode",
    "permissionDenied": "Tinanggihan ang camera. Gamitin ang manual na pagpasok.",
    "manualPlaceholder": "Ilagay ang ISBN o barcode..."
  }
}
```

- [ ] **Step 3: Create `src/i18n/index.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import tl from './tl.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tl: { translation: tl } },
  lng: localStorage.getItem('librams-lang') ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export { i18n };
```

- [ ] **Step 4: Update `src/main.tsx` to init i18n**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/web/src/i18n apps/web/src/main.tsx
git commit -m "feat(web): i18n setup (English + Filipino)"
```

---

## Task 5: Shared Components

**Files:**
- Create: `apps/web/src/components/StatusBadge.tsx`
- Create: `apps/web/src/components/BookCard.tsx`
- Create: `apps/web/src/components/GenreChips.tsx`
- Create: `apps/web/src/components/SkeletonCard.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/__tests__/StatusBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('shows green for available', () => {
    render(<StatusBadge available={3} total={5} />);
    expect(screen.getByText('✓ Available')).toBeInTheDocument();
  });

  it('shows amber for checked out', () => {
    render(<StatusBadge available={0} total={2} />);
    expect(screen.getByText('Checked out')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — "cannot find module '../StatusBadge'"

- [ ] **Step 3: Create `src/components/StatusBadge.tsx`**

```typescript
interface StatusBadgeProps {
  available: number;
  total: number;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  checkedOut: '#f59e0b',
  overdue: '#ef4444',
  holdReady: '#3b82f6',
};

export function StatusBadge({ available, total, size = 'sm' }: StatusBadgeProps) {
  const isAvailable = available > 0;
  const bg = isAvailable ? STATUS_COLORS.available : STATUS_COLORS.checkedOut;
  const label = isAvailable
    ? available === total ? '✓ Available' : `✓ ${available} copies`
    : 'Checked out';
  const fontSize = size === 'sm' ? 9 : 11;

  return (
    <span style={{
      background: bg,
      color: 'white',
      borderRadius: 4,
      padding: size === 'sm' ? '1px 5px' : '2px 8px',
      fontSize,
      fontWeight: 600,
      display: 'inline-block',
    }}>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Create `src/components/BookCard.tsx`**

```typescript
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  readingLevel: string | null;
  availableCopies: number;
  totalCopies: number;
  coverUrl: string | null;
}

const GENRE_COLORS: Record<string, [string, string]> = {
  Fiction: ['#22c55e', '#16a34a'],
  Science: ['#3b82f6', '#2563eb'],
  History: ['#f59e0b', '#d97706'],
  Literature: ['#a855f7', '#9333ea'],
  Math: ['#06b6d4', '#0891b2'],
  Filipino: ['#ef4444', '#dc2626'],
};

function coverGradient(genre: string | null): string {
  const [from, to] = GENRE_COLORS[genre ?? ''] ?? ['#6366f1', '#4f46e5'];
  return `linear-gradient(160deg, ${from}, ${to})`;
}

function coverEmoji(genre: string | null): string {
  const map: Record<string, string> = {
    Fiction: '📗', Science: '🔬', History: '🏛', Literature: '📜', Math: '📐', Filipino: '🇵🇭',
  };
  return map[genre ?? ''] ?? '📚';
}

export function BookCard({ book }: { book: BookSummary }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/book/${book.id}`)}
      style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div style={{
        background: coverGradient(book.genre),
        height: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
      }}>
        {book.coverUrl
          ? <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : coverEmoji(book.genre)
        }
      </div>
      <div style={{ padding: '6px 8px' }}>
        <div style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 2 }}>
          {book.title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, marginBottom: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.author}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <StatusBadge available={book.availableCopies} total={book.totalCopies} />
          {book.readingLevel && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>{book.readingLevel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/GenreChips.tsx`**

```typescript
const DEFAULT_GENRES = ['Fiction', 'Science', 'History', 'Literature', 'Math', 'Filipino'];

interface GenreChipsProps {
  genres?: string[];
  selected: string | null;
  onSelect: (genre: string | null) => void;
}

export function GenreChips({ genres = DEFAULT_GENRES, selected, onSelect }: GenreChipsProps) {
  const all = [null, ...genres];

  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
      {all.map((genre) => {
        const isActive = genre === selected;
        return (
          <button
            key={genre ?? 'all'}
            onClick={() => onSelect(genre)}
            style={{
              background: isActive ? 'white' : 'rgba(255,255,255,0.15)',
              color: isActive ? '#4f46e5' : 'rgba(255,255,255,0.85)',
              fontWeight: isActive ? 700 : 400,
              border: 'none',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {genre ?? 'All'}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/SkeletonCard.tsx`**

```typescript
export function SkeletonCard() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ height: 70, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          animation: 'shimmer 1.5s infinite',
        }} />
      </div>
      <div style={{ padding: '6px 8px' }}>
        <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 5 }} />
        <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, width: '60%' }} />
      </div>
    </div>
  );
}
```

Add shimmer keyframe to `index.html` or a global CSS file. Create `apps/web/src/index.css`:

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

Import it in `main.tsx` — add `import './index.css';` before the `i18n` import.

- [ ] **Step 7: Run tests**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
cd ../..
git add apps/web/src/components apps/web/src/index.css apps/web/src/main.tsx
git commit -m "feat(web): shared components (StatusBadge, BookCard, GenreChips, SkeletonCard)"
```

---

## Task 6: Login Page (Task 24)

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/pages/__tests__/LoginPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';

vi.mock('../../lib/api', () => ({
  api: { post: vi.fn() },
}));

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

describe('LoginPage', () => {
  it('renders identifier field', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Email or Student ID')).toBeInTheDocument();
  });

  it('shows PIN label when input looks like student ID', () => {
    renderLogin();
    const input = screen.getByPlaceholderText('Email or Student ID');
    fireEvent.change(input, { target: { value: '2024-001' } });
    expect(screen.getByText(/Student ID detected/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('PIN')).toBeInTheDocument();
  });

  it('shows Password label when input looks like email', () => {
    renderLogin();
    const input = screen.getByPlaceholderText('Email or Student ID');
    fireEvent.change(input, { target: { value: 'maria@school.edu' } });
    expect(screen.getByText(/Email detected/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd apps/web && pnpm test
```

Expected: FAIL — tests for detection behavior fail (stub page returns nothing)

- [ ] **Step 3: Implement `src/pages/LoginPage.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';

function detectMode(value: string): 'studentId' | 'email' | 'unknown' {
  if (/^\d/.test(value)) return 'studentId';
  if (value.includes('@') || /^[a-zA-Z]/.test(value)) return 'email';
  return 'unknown';
}

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const mode = detectMode(identifier);
  const secretLabel = mode === 'studentId' ? 'PIN' : 'Password';
  const secretType = mode === 'studentId' ? 'tel' : 'password';
  const detectionHint =
    mode === 'studentId' ? 'Student ID detected' :
    mode === 'email' ? 'Email detected' : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: { id: string; name: string; role: string; studentId: string | null; gradeLevel: string | null } }>(
        '/auth/login',
        { identifier, secret }
      );
      setSession(data);
      navigate('/search', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? 'Invalid credentials. Please try again.' : 'Network error.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <motion.div
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 360 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📚</div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>LibraMS</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Welcome back</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block', marginBottom: 4 }}>
              Email or Student ID
              {detectionHint && (
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginLeft: 6 }}>
                  ({detectionHint})
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="Email or Student ID"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setSecret(''); }}
              required
              style={inputStyle}
            />
          </div>

          <AnimatePresence mode="wait">
            {identifier.length > 0 && (
              <motion.div
                key={secretLabel}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {secretLabel}
                </label>
                <input
                  type={secretType}
                  placeholder={secretLabel}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  maxLength={mode === 'studentId' ? 6 : undefined}
                  inputMode={mode === 'studentId' ? 'numeric' : undefined}
                  required
                  style={inputStyle}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'white',
              color: '#4f46e5',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              marginTop: 4,
            }}
          >
            {loading ? '...' : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  color: 'white',
  outline: 'none',
};
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/web/src/pages/LoginPage.tsx apps/web/src/pages/__tests__
git commit -m "feat(web): login page with auto-detect student ID / email"
```

---

## Task 7: Search Page (Task 25)

**Files:**
- Modify: `apps/web/src/pages/SearchPage.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/__tests__/SearchPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchPage } from '../SearchPage';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ hits: [], totalHits: 0 }),
  },
}));

describe('SearchPage', () => {
  it('renders search bar', () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/Search books/i)).toBeInTheDocument();
  });

  it('renders All genre chip', () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows no-results message when empty', async () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/No books found/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd apps/web && pnpm test
```

Expected: FAIL

- [ ] **Step 3: Implement `src/pages/SearchPage.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { BookCard, BookSummary } from '../components/BookCard';
import { GenreChips } from '../components/GenreChips';
import { SkeletonCard } from '../components/SkeletonCard';
import { saveCatalogSnapshot } from '../lib/catalog-cache';

interface SearchResponse {
  hits: BookSummary[];
  totalHits: number;
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchBooks();
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, genre]);

  async function fetchBooks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (genre) params.set('genre', genre);
      const data = await api.get<SearchResponse>(`/catalog/books?${params}`);
      setBooks(data.hits);
      void saveCatalogSnapshot(data.hits);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <input
        type="search"
        placeholder="Search books, authors, ISBN..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 14,
          color: 'white',
          outline: 'none',
          marginBottom: 10,
        }}
      />
      <div style={{ marginBottom: 12 }}>
        <GenreChips selected={genre} onSelect={setGenre} />
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p>No books found. Try different keywords.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {books.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </div>
  );
}
```

Create a stub `src/lib/catalog-cache.ts` (full version in Task 12):

```typescript
import type { BookSummary } from '../components/BookCard';

export async function saveCatalogSnapshot(_books: BookSummary[]): Promise<void> {
  // implemented in Task 12
}

export async function getCatalogSnapshot(): Promise<BookSummary[]> {
  return [];
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/src/pages/SearchPage.tsx apps/web/src/lib/catalog-cache.ts apps/web/src/pages/__tests__/SearchPage.test.tsx
git commit -m "feat(web): catalog search page with genre chips and 2-col grid"
```

---

## Task 8: Book Detail Page (Task 26)

**Files:**
- Modify: `apps/web/src/pages/BookDetailPage.tsx`
- Create: `apps/web/src/pages/__tests__/BookDetailPage.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/__tests__/BookDetailPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookDetailPage } from '../BookDetailPage';

const mockBook = {
  id: 'book-1', title: 'Noli Me Tangere', author: 'Jose Rizal',
  genre: 'Fiction', readingLevel: 'Grade 9', availableCopies: 3, totalCopies: 3,
  description: 'A social novel.', coverUrl: null,
  isbn: '978-971', publisher: 'National Book', publicationYear: 1887, language: 'Filipino',
  pageCount: 302, subjectTags: [], deweyDecimal: null, schoolId: 's1', createdAt: '2024-01-01',
};

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue(mockBook), post: vi.fn() },
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/book/book-1']}>
      <Routes>
        <Route path="/book/:id" element={<BookDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BookDetailPage', () => {
  it('shows book title after load', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Noli Me Tangere')).toBeInTheDocument());
  });

  it('shows separate Checkout and Place Hold buttons', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Checkout')).toBeInTheDocument();
      expect(screen.getByText('Place Hold')).toBeInTheDocument();
    });
  });

  it('shows About, Copies, Related tabs', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument();
      expect(screen.getByText('Copies')).toBeInTheDocument();
      expect(screen.getByText('Related')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd apps/web && pnpm test
```

Expected: FAIL

- [ ] **Step 3: Implement `src/pages/BookDetailPage.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, ApiError } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';

interface BookDetail {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  readingLevel: string | null;
  availableCopies: number;
  totalCopies: number;
  description: string | null;
  coverUrl: string | null;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  language: string;
  pageCount: number | null;
  subjectTags: string[] | null;
}

type Tab = 'about' | 'copies' | 'related';

const GENRE_COLORS: Record<string, [string, string]> = {
  Fiction: ['#22c55e', '#16a34a'],
  Science: ['#3b82f6', '#2563eb'],
  History: ['#f59e0b', '#d97706'],
  Literature: ['#a855f7', '#9333ea'],
  Math: ['#06b6d4', '#0891b2'],
  Filipino: ['#ef4444', '#dc2626'],
};

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('about');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [holdLoading, setHoldLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!id) return;
    void api.get<BookDetail>(`/catalog/books/${id}`).then(setBook);
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleCheckout() {
    if (!book) return;
    setCheckoutLoading(true);
    try {
      const result = await api.post<{ dueDate: string }>('/circulation/checkout', { bookId: book.id });
      showToast(`Checked out! Due ${new Date(result.dueDate).toLocaleDateString()}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Checkout failed.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handlePlaceHold() {
    if (!book) return;
    setHoldLoading(true);
    try {
      const result = await api.post<{ queuePosition: number }>('/circulation/holds', { bookId: book.id });
      showToast(`Hold placed — you are #${result.queuePosition} in line`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Hold failed.');
    } finally {
      setHoldLoading(false);
    }
  }

  if (!book) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: 'white', opacity: 0.5 }}>Loading...</div>
      </div>
    );
  }

  const [fromColor, toColor] = GENRE_COLORS[book.genre ?? ''] ?? ['#6366f1', '#4f46e5'];

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(79,70,229,0.95)',
        backdropFilter: 'blur(8px)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
      </div>

      {/* Book info section */}
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 14, marginBottom: 16 }}>
        <div style={{
          background: `linear-gradient(160deg, ${fromColor}, ${toColor})`,
          borderRadius: 10, width: 56, height: 76,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
        }}>
          {book.coverUrl
            ? <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
            : '📚'}
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{book.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6 }}>
            {book.author}{book.publicationYear ? ` · ${book.publicationYear}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge available={book.availableCopies} total={book.totalCopies} size="md" />
            {book.genre && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{book.genre}</span>}
            {book.readingLevel && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{book.readingLevel}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
          {(['about', 'copies', 'related'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#4f46e5' : 'rgba(255,255,255,0.6)',
                fontWeight: activeTab === tab ? 700 : 400,
                fontSize: 13, textTransform: 'capitalize',
              }}
            >
              {tab === 'about' ? 'About' : tab === 'copies' ? 'Copies' : 'Related'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        {activeTab === 'about' && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              {book.description ?? 'No description available.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {book.isbn && <Chip>{`ISBN: ${book.isbn}`}</Chip>}
              {book.publisher && <Chip>{book.publisher}</Chip>}
              {book.language && <Chip>{book.language}</Chip>}
              {book.pageCount && <Chip>{`${book.pageCount} pages`}</Chip>}
            </div>
          </div>
        )}

        {activeTab === 'copies' && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 12 }}>
              {book.availableCopies} of {book.totalCopies} copies available
            </p>
            <StatusBadge available={book.availableCopies} total={book.totalCopies} size="md" />
          </div>
        )}

        {activeTab === 'related' && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Related books coming soon.</p>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleCheckout}
          disabled={book.availableCopies === 0 || checkoutLoading}
          style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none',
            background: book.availableCopies > 0 ? 'white' : 'rgba(255,255,255,0.2)',
            color: book.availableCopies > 0 ? '#4f46e5' : 'rgba(255,255,255,0.4)',
            fontWeight: 700, fontSize: 15, cursor: book.availableCopies > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {checkoutLoading ? '...' : 'Checkout'}
        </button>
        <button
          onClick={handlePlaceHold}
          disabled={holdLoading}
          style={{
            width: '100%', padding: 14, borderRadius: 10,
            border: '2px solid rgba(255,255,255,0.5)',
            background: 'transparent',
            color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}
        >
          {holdLoading ? '...' : 'Place Hold'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', bottom: 80, left: 16, right: 16,
            background: 'rgba(0,0,0,0.8)', color: 'white',
            borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center',
          }}
        >{toast}</motion.div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)',
      borderRadius: 6, padding: '3px 8px', fontSize: 11,
    }}>{children}</span>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/src/pages/BookDetailPage.tsx apps/web/src/pages/__tests__/BookDetailPage.test.tsx
git commit -m "feat(web): book detail page with tabs and separate checkout/hold buttons"
```

---

## Task 9: My Books Page (Task 27)

**Files:**
- Modify: `apps/web/src/pages/MyBooksPage.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/__tests__/MyBooksPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyBooksPage } from '../MyBooksPage';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockImplementation((path: string) => {
      if (path.includes('checkouts')) return Promise.resolve({ checkouts: [
        { id: 'co1', book: { title: 'Noli Me Tangere', author: 'Jose Rizal', genre: 'Fiction' },
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), renewalCount: 0, maxRenewals: 2 }
      ]});
      if (path.includes('holds')) return Promise.resolve({ holds: [] });
      return Promise.resolve({});
    }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('MyBooksPage', () => {
  it('shows checked out book', async () => {
    render(<MemoryRouter><MyBooksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Noli Me Tangere')).toBeInTheDocument());
  });

  it('shows Renew button', async () => {
    render(<MemoryRouter><MyBooksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Renew')).toBeInTheDocument());
  });

  it('shows empty holds message', async () => {
    render(<MemoryRouter><MyBooksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/No holds placed/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
cd apps/web && pnpm test
```

Expected: FAIL

- [ ] **Step 3: Implement `src/pages/MyBooksPage.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';

interface Checkout {
  id: string;
  book: { title: string; author: string; genre: string | null };
  dueDate: string;
  renewalCount: number;
  maxRenewals: number;
}

interface Hold {
  id: string;
  book: { title: string; author: string };
  queuePosition: number;
  status: string;
  expiresAt: string | null;
}

function dueDateColor(dueDate: string): string {
  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return '#ef4444';
  if (daysLeft <= 5) return '#f59e0b';
  return '#22c55e';
}

function dueDateLabel(dueDate: string): string {
  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)} days`;
  if (daysLeft === 0) return 'Due today';
  return `Due in ${daysLeft} days`;
}

export function MyBooksPage() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    void api.get<{ checkouts: Checkout[] }>('/circulation/my/checkouts').then((r) => setCheckouts(r.checkouts));
    void api.get<{ holds: Hold[] }>('/circulation/my/holds').then((r) => setHolds(r.holds));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleRenew(checkoutId: string) {
    try {
      await api.post('/circulation/renew', { checkoutId });
      const updated = await api.get<{ checkouts: Checkout[] }>('/circulation/my/checkouts');
      setCheckouts(updated.checkouts);
      showToast('Renewed successfully!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Renewal failed.');
    }
  }

  async function handleCancelHold(holdId: string) {
    try {
      await api.delete(`/circulation/holds/${holdId}`);
      setHolds((prev) => prev.filter((h) => h.id !== holdId));
      showToast('Hold cancelled.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Cancel failed.');
    }
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <Section title="Checked Out">
        {checkouts.length === 0
          ? <Empty>No books checked out — explore the catalog!</Empty>
          : checkouts.map((co) => (
            <div key={co.id} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{co.book.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 6 }}>{co.book.author}</div>
                  <span style={{ color: dueDateColor(co.dueDate), fontSize: 11, fontWeight: 600 }}>
                    {dueDateLabel(co.dueDate)}
                  </span>
                </div>
                <button
                  onClick={() => void handleRenew(co.id)}
                  disabled={co.renewalCount >= co.maxRenewals}
                  style={{
                    background: co.renewalCount < co.maxRenewals ? 'white' : 'rgba(255,255,255,0.15)',
                    color: co.renewalCount < co.maxRenewals ? '#4f46e5' : 'rgba(255,255,255,0.3)',
                    border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12,
                    fontWeight: 600, cursor: co.renewalCount < co.maxRenewals ? 'pointer' : 'not-allowed',
                  }}
                >
                  Renew
                </button>
              </div>
            </div>
          ))
        }
      </Section>

      <Section title="Holds">
        {holds.length === 0
          ? <Empty>No holds placed.</Empty>
          : holds.map((hold) => (
            <div key={hold.id} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{hold.book.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 4 }}>{hold.book.author}</div>
                  {hold.status === 'ready' && hold.expiresAt ? (
                    <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                      Ready — pick up by {new Date(hold.expiresAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                      You are #{hold.queuePosition} in line
                    </span>
                  )}
                </div>
                <button
                  onClick={() => void handleCancelHold(hold.id)}
                  style={{
                    background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8,
                    padding: '6px 10px', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Cancel Hold
                </button>
              </div>
            </div>
          ))
        }
      </Section>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, right: 16,
          background: 'rgba(0,0,0,0.8)', color: 'white',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center',
        }}>{toast}</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{children}</p>;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/src/pages/MyBooksPage.tsx apps/web/src/pages/__tests__/MyBooksPage.test.tsx
git commit -m "feat(web): my books page with renewals and hold management"
```

---

## Task 10: Account Page (Task 27)

**Files:**
- Modify: `apps/web/src/pages/AccountPage.tsx`

- [ ] **Step 1: Implement `src/pages/AccountPage.tsx`**

```typescript
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { i18n } from '../i18n/index';

export function AccountPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const currentLang = i18n.language;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function toggleLanguage() {
    const next = currentLang === 'en' ? 'tl' : 'en';
    void i18n.changeLanguage(next);
    localStorage.setItem('librams-lang', next);
  }

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24, paddingBottom: 32 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12,
        }}>
          {initials}
        </div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{user?.name ?? '—'}</div>
        {user?.studentId && (
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>ID: {user.studentId}</div>
        )}
        {user?.gradeLevel && (
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{user.gradeLevel}</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SettingRow label="Language" value={currentLang === 'en' ? 'English' : 'Filipino'} onPress={toggleLanguage} />
      </div>

      <button
        onClick={handleLogout}
        style={{
          width: '100%', marginTop: 40, padding: 14, borderRadius: 10,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          color: '#fca5a5', fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

function SettingRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none',
        borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{value} ›</span>
    </button>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/web/src/pages/AccountPage.tsx
git commit -m "feat(web): account page with language toggle and sign out"
```

---

## Task 11: Scan Page — Barcode Scanner (Task 28)

**Files:**
- Modify: `apps/web/src/pages/ScanPage.tsx`

- [ ] **Step 1: Implement `src/pages/ScanPage.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export function ScanPage() {
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState('');
  const scannerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (manualMode) return;
    let quagga: typeof import('quagga2') | null = null;

    void (async () => {
      try {
        const Q = await import('quagga2');
        quagga = Q;
        Q.default.init(
          {
            inputStream: {
              type: 'LiveStream',
              target: scannerRef.current ?? undefined,
              constraints: { facingMode: 'environment' },
            },
            decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader'] },
            locate: true,
          },
          (err) => {
            if (err) { setPermissionDenied(true); return; }
            Q.default.start();
          }
        );
        Q.default.onDetected(({ codeResult }) => {
          if (codeResult.code) void handleScan(codeResult.code);
        });
      } catch {
        setPermissionDenied(true);
      }
    })();

    return () => { quagga?.default.stop(); };
  }, [manualMode]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleScan(code: string) {
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    try {
      const book = await api.get<{ id: string }>(`/catalog/isbn/${code}`);
      navigate(`/book/${book.id}`);
    } catch {
      showToast('Barcode not recognized');
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await handleScan(manualInput.trim());
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {!manualMode && !permissionDenied && (
        <>
          <div ref={scannerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
          {flash && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.4)', zIndex: 5, pointerEvents: 'none' }} />
          )}
          {/* Reticle overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>
            <div style={{
              width: 240, height: 120, borderRadius: 12,
              border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }} />
            <p style={{ color: 'white', marginTop: 20, fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              Point at barcode
            </p>
          </div>
        </>
      )}

      {permissionDenied && (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📵</div>
          <p style={{ color: 'white', marginBottom: 16 }}>Camera access denied. Use manual entry.</p>
        </div>
      )}

      {/* Manual entry toggle */}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, zIndex: 10, padding: '0 24px' }}>
        {manualMode ? (
          <form onSubmit={(e) => void handleManualSubmit(e)} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Enter ISBN or barcode..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoFocus
              style={{
                flex: 1, background: 'rgba(255,255,255,0.9)', border: 'none',
                borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#0f172a',
              }}
            />
            <button type="submit" style={{
              background: 'white', border: 'none', borderRadius: 10, padding: '0 16px',
              color: '#4f46e5', fontWeight: 700, cursor: 'pointer',
            }}>Go</button>
          </form>
        ) : (
          <button
            onClick={() => setManualMode(true)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 10, padding: 12, color: 'white', fontSize: 14, cursor: 'pointer',
            }}
          >
            Enter manually
          </button>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'absolute', top: 24, left: 16, right: 16, zIndex: 20,
          background: 'rgba(0,0,0,0.8)', color: 'white',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center',
        }}>{toast}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/web/src/pages/ScanPage.tsx
git commit -m "feat(web): barcode scanner page with Quagga2 + manual fallback"
```

---

## Task 12: PWA Setup (Task 29)

**Files:**
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/public/manifest.json`
- Modify: `apps/web/src/lib/catalog-cache.ts`
- Modify: `apps/web/index.html`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "LibraMS",
  "short_name": "LibraMS",
  "description": "School Library Management System",
  "start_url": "/search",
  "display": "standalone",
  "background_color": "#4f46e5",
  "theme_color": "#4f46e5",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create placeholder icons directory**

```bash
mkdir -p apps/web/public/icons
```

Create `apps/web/public/icons/README.md`:
```
Place icon-192.png and icon-512.png here.
Both should be indigo (#4f46e5) background with white book emoji.
Generate at: https://favicon.io/favicon-generator/ or use ImageMagick:
  convert -size 192x192 xc:#4f46e5 -font DejaVu-Sans -pointsize 100 -fill white -gravity center -annotate 0 "📚" icon-192.png
```

- [ ] **Step 3: Update `vite.config.ts` with PWA plugin**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // using public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Add manifest link to `index.html`**

Open `apps/web/index.html`. In the `<head>`, add after the charset meta:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#4f46e5" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- [ ] **Step 5: Implement `src/lib/catalog-cache.ts` with IndexedDB**

```typescript
import { openDB } from 'idb';
import type { BookSummary } from '../components/BookCard';

const DB_NAME = 'librams-catalog';
const STORE = 'books';
const MAX_ENTRIES = 500;

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function saveCatalogSnapshot(books: BookSummary[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    const slice = books.slice(0, MAX_ENTRIES);
    await Promise.all(slice.map((b) => tx.store.put(b)));
    await tx.done;
  } catch {
    // silently fail — offline cache is best-effort
  }
}

export async function getCatalogSnapshot(): Promise<BookSummary[]> {
  try {
    const db = await getDB();
    return await db.getAll(STORE);
  } catch {
    return [];
  }
}
```

- [ ] **Step 6: Update SearchPage to fall back to cached data offline**

Open `apps/web/src/pages/SearchPage.tsx`. Replace the catch block in `fetchBooks`:

```typescript
async function fetchBooks() {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (genre) params.set('genre', genre);
    const data = await api.get<SearchResponse>(`/catalog/books?${params}`);
    setBooks(data.hits);
    void saveCatalogSnapshot(data.hits);
  } catch {
    // Offline fallback: filter cached books
    const cached = await getCatalogSnapshot();
    const filtered = cached.filter((b) => {
      const matchesQuery = !query || b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.author.toLowerCase().includes(query.toLowerCase());
      const matchesGenre = !genre || b.genre === genre;
      return matchesQuery && matchesGenre;
    });
    setBooks(filtered);
  } finally {
    setLoading(false);
  }
}
```

Also add the import at the top of `SearchPage.tsx`:
```typescript
import { saveCatalogSnapshot, getCatalogSnapshot } from '../lib/catalog-cache';
```

- [ ] **Step 7: Add `.superpowers/` to `.gitignore`**

Open `apps/web/../.gitignore` (root `librams/.gitignore`) and add:

```
.superpowers/
```

- [ ] **Step 8: Run all tests**

```bash
cd apps/web && pnpm test
```

Expected: all PASS

- [ ] **Step 9: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 10: Commit**

```bash
cd ../..
git add apps/web/vite.config.ts apps/web/public apps/web/src/lib/catalog-cache.ts apps/web/src/pages/SearchPage.tsx apps/web/index.html .gitignore
git commit -m "feat(web): PWA setup — manifest, service worker, IndexedDB offline cache"
```

---

## Task 13: Merge to Master

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && pnpm test && pnpm typecheck
```

Expected: all PASS, no type errors

- [ ] **Step 2: Merge to master**

```bash
cd ../..
git checkout master
git merge feat/group-f-student-portal --no-ff -m "feat(web): Group F student portal (Tasks 24-29)"
```

- [ ] **Step 3: Update PROGRESS.md**

Mark Tasks 24–29 as complete (✅) in `librams/docs/PROGRESS.md`.

- [ ] **Step 4: Commit progress update**

```bash
git add docs/PROGRESS.md
git commit -m "docs: mark Group F (Tasks 24-29) complete"
```
