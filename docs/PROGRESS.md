# LibraMS — Development Progress Tracker

> Last updated: 2026-06-03
> Branch: `master` | Tests: 521 passing (api 350, admin 122, web 49)
> Last commit: `3f2852c` — docs: PROGRESS.md update (Tasks 71–76 complete)
> Next: Task 77 — student interest onboarding (`users.interests` col already in migration 0015)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete — committed & merged to master |
| 🔄 | In progress |
| ⬜ | Pending — not started |
| 🚫 | Blocked |

---

## Phase 1 — MVP ✅ COMPLETE

Goal: Catalog search → Checkout/return → Web portal → Auth

---

### Group A: Scaffold & Infrastructure

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 10 | `packages/shared` — Zod schemas | Shared types for users, books, checkouts, holds, auth | ✅ |
| 11 | `apps/api` skeleton | Hono app, `/health` endpoint, env validation, structured logging | ✅ |
| 12 | `apps/web` + `apps/admin` | React 18 + Vite — student portal & staff dashboard skeletons | ✅ |
| 13 | Docker Compose + `.env.example` | PostgreSQL 15, Redis 7, Meilisearch v1.11 — all healthy | ✅ |
| 14 | Drizzle schema files | 8 tables: users, schools, books, book_inventory, checkouts, holds, refresh_tokens, audit_log | ✅ |
| 15 | Initial migration | Applied all migrations to local DB | ✅ |
| 16 | Verify full stack | Confirmed all services running; updated CLAUDE.md with build commands | ✅ |

---

### Group B: Authentication

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 17 | JWT helpers + `requireAuth` middleware | `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, rate limiter, Bearer guard | ✅ |
| 18 | Auth service + HTTP routes | `login()` (email+password / studentID+PIN auto-detect), `refreshSession()`, `logout()`, `/me` — 4 endpoints at `/api/v1/auth/*` | ✅ |

---

### Group C: Staff Registration & Approval (Task 19)

| # | Sub-task | What it covers | Status |
|---|----------|----------------|--------|
| 19-1 | Feature branch + shared schemas | Added `password` to `RegisterStaffSchema`; added `VerifyEmailSchema`, `SetPasswordSchema`, `CreateStaffByAdminSchema` | ✅ |
| 19-2 | DB schema: `approvalStatus` + `verification_tokens` | `approval_status` enum on users table; new `verification_tokens` table; migrations applied | ✅ |
| 19-3 | `email.service.ts` | SendGrid wrapper — `sendVerificationEmail`, `sendStaffInviteEmail`, `sendRejectionEmail`; HTML escaping; error chaining | ✅ |
| 19-4 | `token.service.ts` | SHA-256 hashed one-time tokens — `createToken`, `consumeToken`; expires; marks used | ✅ |
| 19-5 | `staff.service.ts` | `registerStaff`, `approveStaff`, `rejectStaff`, `createStaffByAdmin`, `verifyEmail`, `setPasswordFromInvite`, `listPendingStaff` | ✅ |
| 19-6 | Auth login guards | Added to `login()`: `APPROVAL_PENDING`, `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED` — email-only, PIN users unaffected | ✅ |
| 19-7 | HTTP routes — staff | `POST /api/v1/auth/register`, `/verify-email`, `/set-password`; admin routes for pending/approve/reject | ✅ |
| 19-8 | Env vars + typecheck + merge | Added `SENDGRID_API_KEY`, `EMAIL_FROM`, `APP_URL` to vitest config + `.env.example`; merged to master | ✅ |

---

### Group D: Catalog Service

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 20 | Catalog dependencies | Install: Redis client (`ioredis`), Meilisearch client, ISBN lookup (Google Books / Open Library) | ✅ |
| 21 | `catalog.service.ts` + routes | Book CRUD, ISBN auto-fill, Meilisearch indexing/search, copy management, barcode assignment | ✅ |

---

### Group E: Circulation

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 22 | `circulation.service.ts` | Checkout, return (3-stage: `returned` → `being_processed` → `shelved`), renewal, hold queue with position tracking | ✅ |
| 23 | Circulation HTTP routes | Checkout, return, return-advance, renew, holds CRUD, my-checkouts, my-holds, shelving-queue | ✅ |

---

### Group F: Student Web Portal (`apps/web`)

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 24 | Auth pages | Login page (auto-detect: email vs student ID+PIN), logout, session persistence via Zustand | ✅ |
| 25 | Catalog search UI | Search bar with Meilisearch, faceted filters (genre, level, availability, language), book cards | ✅ |
| 26 | Book detail page | Full book info, availability status, hold button, related books | ✅ |
| 27 | My account page | Active checkouts, due dates, hold queue position, renewal button, reading history | ✅ |
| 28 | Barcode scanner | Camera-based scanning via @ericblade/quagga2 for student self-checkout | ✅ |
| 29 | PWA setup | Service Worker, offline cache, installable manifest, IndexedDB local catalog snapshot | ✅ |

---

### Group G: Staff Dashboard (`apps/admin`)

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 30 | Admin auth + routing | Login page, JWT session, role-based route guards | ✅ |
| 31 | Pending staff approvals UI | List of pending self-registrations, approve/reject buttons | ✅ |
| 32 | Permissions management | user_permissions table, getEffectivePermissions, admin PATCH endpoint | ✅ |
| 33 | Staff management page | Active staff table, PermissionsDialog, CreateStaffDialog, tabbed StaffManagementPage | ✅ |
| 34 | Login page | email+password form, error code mapping, CORS fix | ✅ |

---

### Group H: Notifications

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 35 | BullMQ + schema | notification_log table + pgEnums + notificationChannel on users + BullMQ/Twilio deps | ✅ |
| 36 | Email provider + notification service | SendGrid for 5 types, deduplication, audit log | ✅ |
| 37 | SMS + scheduler + routes | Twilio SMS, BullMQ daily 08:00 cron, notification routes | ✅ |

---

### Group I: Barcode & Label Printing

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 38 | Printing service + API routes | PDFKit spine/cover/card/bulk labels, bwip-js Code128+QR, ZPL for Zebra printers | ✅ |
| 39 | Barcode scanner + CirculationPage | @ericblade/quagga2 camera scanner, useBarcodeInput USB hook, CirculationPage | ✅ |

---

## Phase 2 — Engagement ✅ COMPLETE (2026-06-01)

### Group J: Engagement Data Layer

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 40 | Phase 2 DB migrations | reading_lists, book_clubs, badges, user_badges, challenges, challenge_progress, push_subscriptions | ✅ |
| 41 | Reading lists service + routes | Personal CRUD lists, add/remove books, to_read/reading/completed status | ✅ |
| 42 | Book clubs service + routes | Create clubs, join/leave, assign book, member management | ✅ |

### Group L: Student Portal UI (Engagement)

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 43 | Reading lists UI | My Lists page — create, add books, status toggle, detail view | ✅ |
| 44 | Book clubs UI | Browse/join clubs, club detail, member list, create club | ✅ |
| 45 | Badges + challenges UI | Achievement wall, challenge cards, progress bars, leaderboard | ✅ |

### Group M: AI + Push

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 46 | AI recommendations | Claude Haiku personalized book suggestions, Redis 24h cache | ✅ |
| 47 | FCM push notifications | Firebase Admin SDK, push_subscriptions table, service worker, scheduler integration | ✅ |

### Group K: Gamification

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 48 | Badges engine + routes | Auto-award engine (7 criteria), badge CRUD, hooks into checkout/club/list events | ✅ |
| 49 | Challenges service + routes | CRUD, enrollment, progress tracking on checkout, leaderboard | ✅ |

---

## Phase 3 — Admin & Analytics ✅ COMPLETE (2026-06-02)

### Group N: Admin Dashboard

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 50 | Admin circulation UI enhancements | Enhanced CirculationPage with full checkout/return flow, shelving queue tab | ✅ |
| 51 | Reports dashboard | ReportsPage with circulation stats, top borrowed books, overdue-by-grade charts | ✅ |
| 52 | Bulk CSV import | Student roster + book catalog mass upload, validation, error reporting; BulkImportPage | ✅ |

### Group O: Catalog & Data Management

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 53 | MARC import service | Pure TypeScript MARC21 parser (binary ISO 2709 + MARCXML), batch import route | ✅ |
| 54 | Analytics service + routes | Circulation metrics, reading trends, per-school aggregations, export endpoints | ✅ |

### Group P: Configuration & Monitoring

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 55 | School settings backend + admin UI | Settings JSONB CRUD (checkout days, fines, timezone, SSO config), SchoolSettingsPage | ✅ |
| 56 | Prometheus + Grafana monitoring | prom-client metrics at `/metrics`, Docker services, Grafana provisioning | ✅ |

---

## Phase 4 — Advanced Features ✅ COMPLETE (2026-06-02)

### Group Q: SSO & Identity

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 57 | Google + Microsoft OAuth2/OIDC SSO | Authorization code flow, oauth_accounts table, admin UI login buttons, OAuthCallbackPage | ✅ |
| 58 | LDAP / Active Directory SSO | ldapjs service-account bind→search→user-bind flow, RFC 4515 filter escaping, auth.service integration, test-connection endpoint | ✅ |

### Group R: AI & Search

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 59 | pgvector semantic search + hybrid ML | OpenAI text-embedding-3-small (1536d), cosine similarity via `<=>`, hybrid Meilisearch+vector recommendations, `GET /catalog/search/semantic` | ✅ |

### Group S: Integrations & Multi-tenancy

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 60 | Webhooks system | `webhooks` table, CRUD API, BullMQ delivery queue, HMAC-SHA256 signing, 3-retry exponential backoff, WebhooksPage admin UI | ✅ |
| 61 | Multi-tenant super-admin | `super_admin` role, school registration/listing API at `/api/v1/super-admin/*`, nullable schoolId in JWT, SchoolsManagementPage admin UI | ✅ |

---

## Phase 5 — Admin Completion & Operations ✅ COMPLETE (2026-06-02)

Goal: Fill placeholder admin pages, add fine management, notification config, hold expiry, inventory tools.

### Group T: Admin UI Stubs

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 62 | Admin Dashboard home | Overview metrics: checkouts today, overdue count, holds queue, active users, recent activity | ✅ `1c438c5` |
| 63 | Catalog management UI | Book list (TanStack Table), add/edit dialog with ISBN auto-fill + AI metadata assist, copy management | ✅ `d203001` |
| 64 | Students management UI | Student roster list, search by name/ID, view profile + checkout history, reset PIN | ✅ `9070c81` |
| 65 | Shelving queue UI | Dedicated page: returned → being_processed → shelved; scan/tap to advance stage; timestamps | ✅ `aed0932` |
| 66 | Audit log UI | Paginated table of admin actions — actor, action, affected record, timestamp; filter by action type | ✅ `7603d54` |

### Group U: Operations & Configuration

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 67 | Fine management | `fine_per_day` + `grace_period_days` in school settings schema; admin fines list; waive + mark-paid endpoints | ✅ `07f3a75` |
| 68 | Notification settings | `reminder_days_before`, `overdue_repeat_every`, `notification_time`, `sms_sender_id` in school settings; scheduler reads from DB | ✅ `9b7a09f` |
| 69 | Hold expiry | `hold_expiry_days` school setting; BullMQ daily job auto-expires holds; admin manual override endpoint | ✅ `0a9a4a0` |
| 70 | Inventory tools | Shelf audit (scan barcodes vs expected); missing books report; condition update per copy | ✅ `48e8c29` |

---

## Phase 6 — Kiosk UI, Teacher Features & Polish 🔄 IN PROGRESS

Goal: Build the kiosk surface (spec'd in detail), add school year/class section teacher workflow, S3 file storage, i18n.

### Group V: Kiosk UI

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 71 | Kiosk base | `/kiosk` route tree; KioskShell (idle detection, InactivityOverlay); AttractScreen (cover mosaic, bilingual CTA); KioskGuestHome; KioskLoginPage; KioskBookDetail | ✅ `8198667` |
| 72 | Kiosk AI search bar | KioskSearchBar: typewriter placeholder (8 bilingual examples), animated suggestion chips (staggered fade-in), onSearch callback | ✅ `8198667` |
| 73 | Kiosk checkout flow | KioskCheckoutFlow: 3-step wizard (scanning → confirming → success), receipt card, 10s auto-return countdown | ✅ `8198667` |

### Group W: Teacher & School Year Features

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 74 | School year management | `school_years` table + API (list/create/update/activate/delete); SchoolYearsPage admin UI | ✅ `981491d` |
| 75 | Class sections | `class_sections` + junction tables; full CRUD + teacher/student roster management; ClassSectionsPage admin UI with detail drawer | ✅ `981491d` |
| 76 | Teacher-referred books | `section_book_assignments` table (required/optional); GET/POST/DELETE `/class-sections/:id/books`; `GET /class-sections/my/assigned-books` for students; migration 0015 | ✅ `15fe38f` |
| 77 | Student interest onboarding | First-login interest chip screen; `users.interests` JSONB column (migration 0015) | ⬜ |

### Group X: Polish & Infrastructure

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 78 | Book cover uploads + S3/MinIO | MinIO container in docker-compose; upload service; `PATCH /catalog/books/:id/cover`; admin catalog UI; serve via signed URL | ⬜ |
| 79 | i18n Filipino strings | Complete `tl` translation file for `apps/web`; kiosk bilingual toggle; language selector in student profile; all kiosk AI examples in Filipino | ⬜ |
| 80 | RFID Web USB API | HF 13.56 MHz ISO 15693 Web USB integration in browser; encode book ID + copy number to RFID tag; read tag on checkout/return; Zebra ZD421-R ZPL RFID encoding path | ⬜ |

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Phases complete | **5.5 / 6** |
| Tasks complete | **76** |
| Tasks remaining | **4 (Tasks 77–80)** |
| API tests passing | **350** |
| Admin tests passing | **122** |
| Web tests passing | **49** |
| **Total tests** | **521** |
| DB migrations | 15 (0000–0015) |
| DB tables | 25+ |
| API endpoints live | 80+ |
| Roles | student · teacher · librarian · library_assistant · admin · super_admin |

---

## Architecture Summary

```
apps/
├── api/          Hono + Drizzle ORM + PostgreSQL 15 (pgvector) — port 3000
├── web/          React 18 + Vite — student/kiosk portal — port 5173
└── admin/        React 18 + shadcn/ui — staff dashboard — port 5174
packages/
└── shared/       Zod schemas + shared TypeScript types
```

**Infrastructure (Docker):** PostgreSQL 15 (pgvector) · Redis 7 · Meilisearch v1.11 · Prometheus · Grafana

---

## Completed Endpoints (selected)

### Auth
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/health` | Health check |
| POST | `/api/v1/auth/login` | Login (email+password or studentID+PIN) |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/register` | Staff self-registration |
| POST | `/api/v1/auth/verify-email` | Consume email verification token |
| POST | `/api/v1/auth/set-password` | Set password from invite |
| GET | `/api/v1/auth/oauth/:provider` | Initiate Google/Microsoft OAuth |
| GET | `/api/v1/auth/oauth/:provider/callback` | OAuth callback + JWT redirect |
| POST | `/api/v1/auth/ldap/test-connection` | Test LDAP service-account bind |

### Catalog
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/catalog/search` | Meilisearch keyword search |
| GET | `/api/v1/catalog/search/semantic` | pgvector cosine similarity search |
| POST | `/api/v1/catalog/books` | Create book + first copy |
| GET | `/api/v1/catalog/books/:id` | Get book with copies |
| PATCH | `/api/v1/catalog/books/:id` | Update book metadata |
| DELETE | `/api/v1/catalog/books/:id` | Soft-delete book |
| POST | `/api/v1/catalog/books/:id/copies` | Add physical copy |
| GET | `/api/v1/catalog/isbn/:isbn` | ISBN metadata lookup |

### Circulation
| Method | Path | What it does |
|--------|------|--------------|
| POST | `/api/v1/circulation/checkout` | Check out a book |
| POST | `/api/v1/circulation/return` | Return a book |
| POST | `/api/v1/circulation/return/advance` | Advance return stage |
| POST | `/api/v1/circulation/renew` | Renew a checkout |
| POST | `/api/v1/circulation/holds` | Place a hold |
| DELETE | `/api/v1/circulation/holds/:id` | Cancel a hold |
| GET | `/api/v1/circulation/my/checkouts` | Student's active checkouts |
| GET | `/api/v1/circulation/shelving-queue` | Items to shelve |

### Staff / Admin
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/admin/staff/pending` | List pending registrations |
| POST | `/api/v1/admin/staff/:id/approve` | Approve staff account |
| POST | `/api/v1/admin/staff/:id/reject` | Reject staff account |
| POST | `/api/v1/admin/staff` | Create staff by admin |
| PATCH | `/api/v1/admin/staff/:id/permissions` | Update permissions |

### School / Super-Admin
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/schools/settings` | Get school settings |
| PATCH | `/api/v1/schools/settings` | Update school settings |
| GET | `/api/v1/super-admin/schools` | List all schools (super_admin only) |
| POST | `/api/v1/super-admin/schools` | Register new school |
| PATCH | `/api/v1/super-admin/schools/:id` | Update school |

### Webhooks
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/webhooks` | List webhooks for school |
| POST | `/api/v1/webhooks` | Create webhook subscription |
| DELETE | `/api/v1/webhooks/:id` | Delete webhook |
| PATCH | `/api/v1/webhooks/:id/toggle` | Enable/disable webhook |

### Engagement
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/recommendations` | AI-powered book recommendations |
| GET/POST | `/api/v1/reading-lists` | Reading list CRUD |
| GET/POST | `/api/v1/book-clubs` | Book club CRUD |
| GET | `/api/v1/badges` | List badges |
| GET/POST | `/api/v1/challenges` | Challenge CRUD + enrollment |

### Analytics & Monitoring
| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/analytics/dashboard` | Circulation metrics |
| GET | `/api/v1/analytics/reports` | Reports data |
| POST | `/api/v1/import/csv` | Bulk CSV import |
| POST | `/api/v1/import/marc` | MARC21 catalog import |
| GET | `/metrics` | Prometheus scrape endpoint |

---

## Webhook Events

| Event | Triggered when |
|-------|----------------|
| `checkout.created` | Book is checked out |
| `checkout.returned` | Book is returned |
| `hold.placed` | Hold is placed on a book |
| `hold.ready` | Hold copy is available for pickup |
| `overdue.alert` | Book becomes overdue |

---

## Roles & Permissions

| Role | Scope | Access |
|------|-------|--------|
| `student` | School | Catalog, checkouts, holds, reading lists, clubs, challenges |
| `teacher` | School | Same as student + extended loan period |
| `library_assistant` | School | Circulation desk |
| `librarian` | School | All school operations |
| `admin` | School | All school operations + staff management + settings |
| `super_admin` | System | School registration, system-wide management |
