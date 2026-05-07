# Group F — Student Web Portal Design Spec

**Date:** 2026-05-07
**Scope:** `apps/web` — Tasks 24–29 of Phase 1 MVP
**Stack:** React 18 + Vite + Framer Motion + Zustand + react-i18next

---

## 1. Visual Language

**Style:** Friendly & colorful. Purple/indigo gradient backgrounds (`#4f46e5` → `#7c3aed`), white glass-morphism cards (`rgba(255,255,255,0.15)`), rounded corners (`border-radius: 10–12px`), emoji accents, warm copy.

**Typography:** System sans-serif. White on gradient, high-contrast for accessibility (WCAG AA minimum).

**Status colors:**
- Available: `#22c55e` (green)
- Checked out / unavailable: `#f59e0b` (amber)
- Overdue: `#ef4444` (red)
- Hold ready: `#3b82f6` (blue)

**Animations:** Framer Motion — page transitions (`opacity + y: 10px`, 200ms ease-out), card tap feedback (scale 0.97).

---

## 2. Navigation

Bottom tab bar, always visible (except login screen). Four tabs:

| Tab | Icon | Route |
|-----|------|-------|
| Search | 🔍 | `/search` |
| My Books | 📖 | `/my-books` |
| Scan | 📷 | `/scan` |
| Account | 👤 | `/account` |

Active tab: white icon + label. Inactive: `rgba(255,255,255,0.5)`. Tab bar background: solid `#3730a3` (darker indigo) with top border `rgba(255,255,255,0.1)`.

**Routing:** React Router v6. Protected routes redirect unauthenticated users to `/login`. Login page has no tab bar.

---

## 3. Task 24 — Auth Pages

### Login Page (`/login`)

Full-screen gradient background. Centered card layout.

**Header:** Book stack emoji + "LibraMS" wordmark + "Welcome back" subtitle.

**Form — single smart identifier field:**
- Label: "Email or Student ID"
- As user types: if value matches `^\d` (starts with digit) or `^\d{4}-` pattern → detected as Student ID → second field label becomes "PIN" (numeric input, maxLength 6)
- Otherwise → detected as Email → second field label becomes "Password" (standard password input)
- Detection label shown inline in small muted text: `(Student ID detected)` / `(Email detected)`

**Second field:** switches `type` between `password` and `tel` based on detection. No toggle needed — auto-switch is invisible.

**Submit button:** Full-width white button, indigo text "Sign In". Loading state: spinner replaces text.

**Error state:** Shake animation on the card + red error message below the form. Never specify which field is wrong (security).

**Session persistence:** On successful login, store `{ accessToken, refreshToken, user }` in Zustand store + `localStorage`. On app load, rehydrate from localStorage. Access token refresh handled transparently via axios interceptor (or fetch wrapper).

### Logout

Available from Account tab → "Sign Out" button. Clears Zustand store + localStorage. Redirects to `/login`.

---

## 4. Task 25 — Catalog Search UI (`/search`)

### Layout

**Search bar:** Full-width at top, always visible on this tab. Placeholder: "Search books, authors, ISBN..."

**Genre chip row:** Horizontally scrollable row below search bar. Chips: "All", "Fiction", "Science", "History", "Literature", "Math", "Filipino", + any genres from backend. Active chip: white background, indigo text. Inactive: `rgba(255,255,255,0.15)`, white text.

**Results grid:** 2-column grid. Each card:
- Colored cover area (top, height ~70px) — color derived from genre or a hash of the book ID; emoji placeholder if no cover image
- Book title (bold, white, 2-line clamp)
- Author (muted white, 1-line clamp)
- Availability badge (bottom-left, colored per status)
- Grade level (bottom-right, muted)

**Empty state:** "No books found" illustration + suggestion to try different keywords.

**Loading state:** Skeleton cards (same grid, animated shimmer).

### Search behavior

- Debounced 300ms → calls Meilisearch via API (`GET /api/v1/catalog/search?q=&genre=&available=`)
- Genre chip selection filters results immediately (re-queries with genre param)
- No separate "search" button — live results as user types

---

## 5. Task 26 — Book Detail Page (`/book/:id`)

### Layout

**Header (sticky):** Back arrow (←) left-aligned, book title truncated center.

**Book info section (non-scrolling top area):**
- Left: colored cover thumbnail (52px × 72px, rounded, genre color gradient + emoji)
- Right: Title (bold), Author + Year, Genre + Grade level, Availability badge

**Tab bar (Below info):** Three tabs — About · Copies · Related. Underline indicator slides between tabs (Framer Motion layout animation).

**About tab:**
- Full description text
- ISBN, publisher, year, language chips

**Copies tab:**
- List of physical copies: barcode, location (shelf), status per copy
- Shows "X of Y copies available"

**Related tab:**
- 2-col grid of books by same author or same genre, each tappable

### Action buttons (always visible, below tab content or sticky at bottom)

Two separate full-width buttons stacked:
1. **"Checkout"** — white background, indigo text. Disabled + grayed if no copies available.
2. **"Place Hold"** — indigo outline, white background. Always enabled. If student already has an active hold, shows "Cancel Hold" instead.

Checkout triggers a confirmation bottom sheet showing the due date returned by the API (`POST /api/v1/circulation/checkout` response). Place Hold shows queue position returned by the API after confirming.

---

## 6. Task 27 — My Account Page (`/my-books` + `/account`)

### My Books tab (`/my-books`)

Two sections, collapsible:

**Checked Out:**
- Card per book: cover thumbnail, title, author, due date, "Renew" button
- Due date color: green (>5 days), amber (≤5 days), red (overdue)
- "Renew" calls `POST /api/v1/circulation/renew/:checkoutId`. Disabled if max renewals reached.

**Holds:**
- Card per hold: cover thumbnail, title, queue position ("You are #3 in line"), "Cancel Hold" button
- If hold is ready for pickup: green badge "Ready — pick up by [date]"

Empty state for each section: friendly message ("No books checked out — explore the catalog!").

### Account tab (`/account`)

- Avatar (initials-based, indigo circle)
- Name, student ID, grade level
- Reading stats: books read this year, current streak (placeholder for Phase 2 engagement features)
- Language toggle: English / Filipino (react-i18next)
- "Sign Out" button (bottom, destructive red text)

---

## 7. Task 28 — Barcode Scanner (`/scan`)

**Purpose:** Student self-checkout — scan a book's barcode to initiate checkout without staff.

**Layout:**
- Full-screen camera view (Quagga2 live stream)
- Semi-transparent overlay with a scanning reticle (rectangular target zone, animated border)
- "Point at barcode" instruction below reticle
- "Enter manually" text button (fallback — opens ISBN/barcode text input)

**Flow:**
1. On scan detection → vibrate (if supported) + brief green flash overlay
2. Lookup book by barcode via `GET /api/v1/catalog/barcode/:code`
3. If found + available: show checkout confirmation bottom sheet (same as book detail)
4. If found + not available: show "Checked out — place a hold?" bottom sheet
5. If not found: "Barcode not recognized" toast

**Permissions:** Request camera permission on first use. If denied, show instructions + "Enter manually" only.

**Library:** Quagga2 primary, ZXing fallback (lazy-loaded). Code formats: EAN-13, EAN-8, Code128, Code39.

---

## 8. Task 29 — PWA Setup

**Manifest (`/public/manifest.json`):**
- `name`: "LibraMS"
- `short_name`: "LibraMS"
- `theme_color`: "#4f46e5"
- `background_color`: "#4f46e5"
- `display`: "standalone"
- `icons`: 192×192, 512×512 (indigo background + white book emoji SVG)
- `start_url`: "/search"

**New deps required:** `vite-plugin-pwa`, `workbox-window`, `idb`, `quagga2`, `react-router-dom`

**Service Worker (Workbox via vite-plugin-pwa):**
- Cache strategy: NetworkFirst for API calls, CacheFirst for static assets
- Offline page: shown when network fails and no cache hit — "You're offline. Cached catalog available."
- IndexedDB snapshot: after first successful catalog search, cache up to 500 results (title, author, cover color, availability) via `idb` library for offline browsing. Refreshed on each online search.

**Install prompt:** Custom "Add to Home Screen" banner shown after 2nd visit, dismissible, stored in localStorage so it doesn't reappear.

---

## 9. Shared Infrastructure

**API client (`src/lib/api.ts`):**
- Base URL from `VITE_API_URL` env var
- Attaches `Authorization: Bearer <token>` from Zustand store
- Auto-refreshes access token on 401 (queues inflight requests during refresh)
- Throws typed `ApiError` with `code` field matching backend error codes

**Auth store (`src/stores/auth.ts`):** Zustand slice with `user`, `accessToken`, `refreshToken`, `login()`, `logout()`, `refreshSession()`. Persisted to localStorage via `zustand/middleware/persist`.

**Routing:** React Router v6 `createBrowserRouter`. `<ProtectedRoute>` wrapper redirects to `/login` if no token.

**i18n:** `react-i18next` with `en` and `tl` (Filipino) namespaces. Language preference stored in localStorage.

---

## 10. File Structure

```
apps/web/src/
├── components/
│   ├── BottomNav.tsx
│   ├── BookCard.tsx
│   ├── GenreChips.tsx
│   ├── StatusBadge.tsx
│   └── SkeletonCard.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── SearchPage.tsx
│   ├── BookDetailPage.tsx
│   ├── MyBooksPage.tsx
│   ├── ScanPage.tsx
│   └── AccountPage.tsx
├── stores/
│   └── auth.ts
├── lib/
│   └── api.ts
├── i18n/
│   ├── en.json
│   └── tl.json
└── main.tsx
```

---

## 11. Out of Scope (Phase 1)

- Push notifications (Phase 2)
- Reading lists, book clubs, badges (Phase 2)
- RFID scanning (Phase 2)
- Staff/admin views (Group G)
- Kiosk attract screen / auto-logout (Phase 2)
