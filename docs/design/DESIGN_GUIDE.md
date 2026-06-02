# LibraMS — Design Guide

> **Status:** Placeholder tokens active. Final logo + palette pending from owner.
> All `[PLACEHOLDER]` values below must be replaced in the Claude Design pass before production.
> Skeleton pages are built functional-first; Claude Design polishes after logic is verified.

---

## 1. Brand Tokens (Placeholder)

Replace these when the final palette arrives. All tokens are defined in two places:
- `apps/web/src/index.css` — CSS custom properties for the web/kiosk portal
- `apps/admin/src/index.css` — shadcn/ui CSS variables for the admin dashboard

### Color Palette

| Token | Hex | Role |
|-------|-----|------|
| `--color-primary` | `#1B3A6B` | Nav bars, headings, primary buttons |
| `--color-primary-light` | `#2563EB` | Interactive states, links, focus rings |
| `--color-accent` | `#F59E0B` | CTAs, highlights, badges, kiosk chips |
| `--color-success` | `#10B981` | Available status, checkouts confirmed |
| `--color-danger` | `#EF4444` | Overdue, errors, destructive actions |
| `--color-warning` | `#F97316` | Due soon, hold alerts |
| `--color-surface` | `#FFFFFF` | Cards, modals, input backgrounds |
| `--color-bg` | `#F1F5F9` | Page background |
| `--color-text` | `#0F172A` | Body copy |
| `--color-text-muted` | `#64748B` | Secondary labels, metadata |
| `--color-border` | `#E2E8F0` | Card borders, dividers |

> `[PLACEHOLDER]` — swap all values above once the final brand palette is confirmed.

### Logo

```
[PLACEHOLDER — school logo]
File location when ready: apps/web/public/logo.svg + apps/admin/public/logo.svg
Used in: kiosk attract screen, admin AppShell header, printed metadata card, login pages
```

### Typography

| Use | Font | Weight | Size |
|-----|------|--------|------|
| UI body | Inter (system fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI'`) | 400 | 14–16px |
| UI labels | Inter | 500 | 12–14px |
| Page headings | Inter | 700 | 20–28px |
| Kiosk hero text | Inter | 800 | 32–48px |
| Kiosk attract title | Inter | 900 | 56–80px |
| Barcode / ISBN display | JetBrains Mono (or system monospace) | 400 | 12px |

> No custom font loading until design pass — system stack is fine for skeleton.

### Spacing & Radius

```
Base unit:   4px (0.25rem)
Card radius: 12px
Button radius: 8px
Input radius: 8px
Kiosk tap target minimum: 60px height/width
Mouse tap target minimum: 44px height/width
```

---

## 2. Surfaces & Their Design Personalities

The three surfaces are visually distinct by intent.

### Admin Dashboard (`apps/admin` — port 5174)

**Personality:** Dense, efficient, data-forward. Think Notion / Linear.
**Users:** Librarians, library assistants, admins. Power users who spend 4–8h/day here.
**Rules:**
- shadcn/ui components throughout — no custom component reinvention
- TanStack Table for all data lists (books, students, checkouts, fines)
- Compact spacing — `p-4` cards, not `p-8`
- Sidebar navigation (AppShell already built)
- Tables sortable + filterable inline — no separate filter page
- No animations except subtle skeleton loaders
- Status badges: color-coded pill (`available` → green, `checked_out` → blue, `overdue` → red)
- Keyboard-first: librarian uses barcode scanner (keyboard input), all scan targets must be focusable inputs

**Claude Design pass brief:** "Refine to a clean, professional data dashboard. Primary color in sidebar. Tables with hover rows. Status badges. Minimal whitespace — information density matters."

---

### Student Web Portal (`apps/web` — port 5173)

**Personality:** Friendly, mobile-first, tactile. Think Spotify mobile / Apple Books.
**Users:** Students (ages 8–18), teachers. Casual, infrequent sessions.
**Rules:**
- Mobile-first — 390px base, upscale to tablet
- Bottom navigation bar (already built)
- Large book cover images — covers ARE the UI, not text lists
- Generous padding — `p-4` to `p-6` cards
- Subtle Framer Motion page transitions (fade + slide up)
- Dark gradient background (currently `#4f46e5 → #7c3aed` — replace in design pass)
- Cards: white/semi-transparent on dark background
- Status chips inline on book cards (IN / OUT / ON HOLD)
- Touch targets: 48px minimum

**Claude Design pass brief:** "Polish to a modern reading app. Rich dark gradient background. White cards with soft shadows. Large book cover thumbnails. Smooth page transitions via Framer Motion. Friendly, not corporate."

---

### Kiosk UI (`/kiosk` route in `apps/web` — same app, separate route tree)

**Personality:** Theatrical, immersive, self-explanatory. Think airport self-check-in meets Apple TV.
**Users:** Walk-up students and guests at a public terminal. No training. May be 8 years old.
**Rules:**
- Minimum tap target: 60px (touchscreen-first)
- Font sizes 25–50% larger than web portal equivalents
- Book covers dominate every screen — text is secondary
- Maximum 3 actions visible at once — no cognitive overload
- Attract screen runs when idle >30s: full-screen animated book cover grid + school name
- Auto-logout countdown: visible 30s warning when idle during active session
- Search bar is always the hero: centered, large, impossible to miss
- Guest mode shows search + browse only — no checkout, no personal data
- Logged-in mode shows personalized greeting + checkout capability
- High contrast — readable from 1m distance
- No tiny icons without labels
- Bilingual: all UI text toggles English ↔ Filipino based on school language setting
- Animated suggestion chips below search (Framer Motion stagger)

**Claude Design pass brief:** "Build a public library kiosk aesthetic. Full-screen layout. School branding prominent. Giant search bar as hero. Book cover mosaic background on attract screen. High contrast, large text, generous touch targets. Animated but not distracting."

---

## 3. Page Briefs — Admin Dashboard

Each brief contains: purpose, users, primary actions, data shown, and Claude Design notes.

---

### Task 62 — Admin Dashboard Home (`/`)

**Purpose:** At-a-glance operational health for the librarian starting their shift.
**User:** Librarian / admin.
**Primary actions:** Navigate to circulation, view overdue list, check holds queue.
**Data shown:**
- Checkouts today (count)
- Currently overdue (count + quick list of names)
- Active holds queue (count + next ready)
- Books checked out right now (count)
- Recent activity feed (last 10 transactions: who checked out/returned what)
- Quick action buttons: Go to Circulation, Go to Shelving Queue

**Skeleton approach:** 2×3 stat card grid + activity list. shadcn Card + Badge components.
**Claude Design note:** "Dashboard home. Stat cards with icon + number + trend. Activity feed with avatar initials. Primary color accent on most critical metric (overdue). Should feel like a command center."

---

### Task 63 — Catalog Management (`/catalog`)

**Purpose:** Full book inventory management — add, edit, delete titles and copies.
**User:** Librarian / admin.
**Primary actions:** Add book (manual / ISBN / AI), edit book, add copy, delete, search.
**Data shown:**
- Books table: cover thumbnail, title, author, ISBN, copies (available/total), genre, actions
- Add/Edit dialog: all book fields with ISBN auto-fill button + AI metadata assist button
- Copy management panel: list of copies per book with barcode, condition, status
- Bulk import shortcut link

**Skeleton approach:** TanStack Table + Dialog (shadcn). ISBN lookup fires on blur of ISBN field.
**Claude Design note:** "Catalog management. Dense table with inline cover thumbnails (32px). Drawer-style edit panel on row click. ISBN field with a 'Fetch' button that shows a loading spinner. AI assist button with sparkle icon."

---

### Task 64 — Students Management (`/students`)

**Purpose:** View and manage student accounts. Find a student quickly to reset PIN or view history.
**User:** Librarian / admin.
**Primary actions:** Search student by name or ID, view profile, view checkout history, reset PIN, deactivate account.
**Data shown:**
- Students table: name, student ID, grade, active checkouts count, join date, status
- Student detail drawer: profile info, current checkouts, overdue items, reading stats, PIN reset button

**Skeleton approach:** TanStack Table + Sheet (side drawer from shadcn).
**Claude Design note:** "Student roster. Table with status badge (Active/Inactive). Side sheet opens on row click showing student card — avatar initials, stats, checkout list, and a 'Reset PIN' danger button."

---

### Task 65 — Shelving Queue (`/shelving-queue`)

**Purpose:** Library assistant view to work through books that need reshelving.
**User:** Library assistant / librarian.
**Primary actions:** Scan/tap book to advance stage, mark shelved with location.
**Data shown:**
- Two columns: "Returned" pile (stage 1) and "Being Processed" pile (stage 2)
- Each card: book cover, title, barcode, returned-by timestamp, who last touched it
- Scan input at top: focus-locked for USB barcode scanner
- Count badge on each column header

**Skeleton approach:** Two-column card layout. Scan input autofocused. Click card or scan barcode to advance.
**Claude Design note:** "Shelving workflow. Kanban-style two columns. Cards with book cover thumbnail. Scan input styled like a search bar — prominent at top. Stage advance shows a quick success toast. Column headers show count badges."

---

### Task 66 — Audit Log (`/audit-log`)

**Purpose:** Compliance and accountability — track every admin action.
**User:** Admin only.
**Primary actions:** Filter by action type, actor, date range. Export CSV.
**Data shown:**
- Table: timestamp, actor (name + role), action (e.g. `book.created`), affected record (title/ID), IP address
- Filters: action type dropdown, date range picker, actor search

**Skeleton approach:** TanStack Table with server-side pagination. Filter bar above.
**Claude Design note:** "Audit trail. Monospaced action codes in a muted badge. Actor shown as name + role chip. Rows alternate subtle bg. Export button top-right. Timestamp in local time."

---

## 4. Page Briefs — Student Web Portal

---

### Student Portal — General Shell

**Current state:** Dark indigo/violet gradient background (`#4f46e5 → #7c3aed`), bottom nav.
**Claude Design note:** "Replace gradient with the brand primary color scheme. Keep dark background feel — cards float on it. Bottom nav should use accent color for active tab."

---

### Student Profile / Interests Onboarding (Task 77)

**Purpose:** First-login flow for new students to set reading interests.
**User:** Student (first login only, skippable).
**Primary actions:** Tap interest chips to select (multi-select), save, skip.
**Data shown:**
- Greeting: "Hi [Name]! Tell us what you like to read."
- Interest chip grid: Space, Animals, Mystery, Adventure, Sports, History, Science, Fantasy, Romance, Horror, Funny, True Stories (12 chips)
- "Skip for now" link, "Let's go →" CTA

**Skeleton approach:** Full-screen centered layout, chip grid, two buttons.
**Claude Design note:** "Onboarding step. Chips animate in with Framer Motion stagger. Selected chips use accent color fill. Large friendly heading. Background matches main app shell."

---

## 5. Page Briefs — Kiosk UI

---

### Kiosk Attract Screen (Task 71 — idle state)

**Purpose:** Draw passersby in. Runs whenever nobody is interacting.
**Trigger:** 30s inactivity during session OR landing on `/kiosk` without login.
**Content:**
- Full-screen animated grid of recent/popular book covers (mosaic, slow parallax scroll)
- Centered overlay: school logo + "LibraMS Library" name
- Tagline: "Find your next book" (English) / "Hanapin ang susunod mong libro" (Filipino)
- Pulsing CTA button: "Tap to Start" / "I-tap para Magsimula"
- Subtle ambient animation — covers drift slowly, not jarring

**Skeleton approach:** CSS grid of cover `<img>` tags, simple fade-in. CTA button navigates to guest home.
**Claude Design note:** "Attract screen. Full-bleed book cover mosaic with dark overlay for readability. Logo centered. 'Tap to Start' button with pulse animation. Slow CSS parallax on cover grid. School brand color as overlay tint."

---

### Kiosk Guest Home (Task 71 — not logged in)

**Purpose:** Landing state for walk-up users. Primarily a search experience.
**User:** Any student, guest.
**Primary actions:** Search (AI natural language), browse by genre, log in.
**Content:**
- Hero: large search bar, centered, 60px tall minimum
- Typewriter placeholder cycling examples (Task 72)
- Suggestion chips row below search (Task 72)
- "Trending now" book grid (6–8 covers)
- "Log in to check out books" soft banner at bottom
- Small "AI-powered" label below search

**Skeleton approach:** Single-column layout. Search input with onChange → debounced API call. Genre chips row. Book grid below.
**Claude Design note:** "Kiosk home. Search bar is 80% of the visual weight on first view. Giant centered input. Typewriter effect in placeholder. Suggestion chips with animated entrance. Book grid below. Everything oversized — this is a public terminal."

---

### Kiosk Search Results (Task 72)

**Purpose:** Show search results in a touch-friendly grid.
**User:** Any (guest or logged-in).
**Content:**
- Results grid: large covers (min 120px wide), title, author, availability chip
- Tap cover → Book Detail
- Filter chips at top: genre, availability, reading level
- "No results" state with fallback suggestions

**Skeleton approach:** CSS grid, 2-col mobile / 3-col tablet / 4-col desktop. Availability as colored chip.
**Claude Design note:** "Results grid. Covers are the hero. Availability chip overlays bottom of cover. Large tap area — whole card tappable. Subtle hover/focus ring on touch."

---

### Kiosk Book Detail (Task 71–73)

**Purpose:** Full book info + action for the user.
**User:** Guest (can hold) / logged-in (can checkout).
**Content:**
- Large cover image (left on landscape, top on portrait)
- Title, author, genre, reading level, description
- Availability: large status chip (IN / OUT / X copies available)
- Actions: "Check Out" (logged in) / "Place Hold" / "Log in to Check Out" (guest)
- "Similar books" row at bottom

**Skeleton approach:** Two-column layout landscape, single column portrait. Button 64px height.
**Claude Design note:** "Book detail. Cover takes 40% of screen. Status chip large and colored. Action button prominent — minimum 64px. Similar books as horizontal scroll row of covers."

---

### Kiosk Checkout Flow (Task 73)

**Purpose:** Student self-checkout — scan or type book, confirm, get receipt.
**User:** Logged-in student.
**Steps:**
1. Scan input screen — large barcode input, camera scan button, manual entry fallback
2. Confirm screen — book cover + title + due date + "Confirm" (green) / "Cancel" (ghost)
3. Success screen — checkmark animation, "Due: [date]", countdown to auto-logout (10s)

**Skeleton approach:** Three-step wizard. State machine: `scanning → confirming → success`. Step 3 auto-navigates after 10s.
**Claude Design note:** "Checkout wizard. Step 1: scan input takes full screen, camera icon prominent. Step 2: book cover large, due date large, two clear buttons. Step 3: success animation (checkmark), receipt-style layout, countdown timer. All oversized."

---

### Kiosk Auto-Logout Countdown (Task 71)

**Purpose:** Warn user before session ends due to inactivity.
**Trigger:** 90s inactivity (configurable).
**Content:**
- Overlay (semi-transparent dark) on top of current screen
- "Still there?" heading
- Large countdown number (30 → 0)
- "Yes, I'm here" button (resets timer)
- Dismisses automatically at 0 → returns to attract screen

**Skeleton approach:** Fixed overlay div, `setInterval` countdown, click-anywhere-to-dismiss.
**Claude Design note:** "Inactivity overlay. Dark semi-transparent backdrop. Countdown number large (128px). 'Still here?' button accent-colored. Subtle fade-in animation."

---

## 6. Claude Design Pass Instructions

When the final logo and palette arrive, run a design pass on each page using this workflow:

1. **Update tokens first** — replace all `[PLACEHOLDER]` hex values in `apps/web/src/index.css` and `apps/admin/src/index.css`
2. **Add logo files** — `apps/web/public/logo.svg`, `apps/admin/public/logo.svg`
3. **Pass each page to Claude Design** with:
   - The Claude Design note from this guide (copy verbatim as the design brief)
   - The current page source file path
   - Brand tokens (updated CSS variables)
   - Component library in use (shadcn/ui for admin, plain Tailwind + Framer Motion for web/kiosk)
4. **Review functional parity** — design pass must not break data fetching, form submission, or navigation
5. **Commit design separately** from functional commits — one commit per page, prefix `design:`

### Design Pass Order (recommended)

Admin first (faster — shadcn does the heavy lifting):
`Dashboard → Catalog → Students → Shelving Queue → Audit Log → Fine Management → Settings`

Then web portal:
`Login → Search → Book Detail → My Books → Account → Onboarding`

Then kiosk last (most custom work):
`Attract Screen → Guest Home → Search Results → Book Detail → Checkout Flow`

---

## 7. What NOT to Change During Design Pass

- Route structure — no URL changes
- API call sites — no service layer touches
- Zod validation — no schema changes
- Test files — design pass is visual only
- shadcn/ui component internals — extend via `className`, not by modifying component files
