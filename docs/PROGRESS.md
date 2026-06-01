# LibraMS — Development Progress Tracker

> Last updated: 2026-05-31
> Branch: `master` | Tests: 190 passing | Typecheck: clean

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete — committed & merged to master |
| 🔄 | In progress |
| ⬜ | Pending — not started |
| 🚫 | Blocked |

---

## Phase 1 — MVP

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
| 19-6 | Auth login guards | Added to `login()`: `APPROVAL_PENDING` (pending), `ACCOUNT_INACTIVE` (rejected), `EMAIL_NOT_VERIFIED` (unverified) — email-only, PIN users unaffected | ✅ |
| 19-7 | HTTP routes — staff | `POST /api/v1/auth/register`, `/verify-email`, `/set-password`; admin routes: `GET/POST /api/v1/admin/staff/pending`, `/:id/approve`, `/:id/reject`, `/` | ✅ |
| 19-8 | Env vars + typecheck + merge | Added `SENDGRID_API_KEY`, `EMAIL_FROM`, `APP_URL` to vitest config + `.env.example`; typecheck clean; merged to master | ✅ |

---

### Group D: Catalog Service

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 20 | Catalog dependencies | Install: Redis client (`ioredis`), Meilisearch client (`meilisearch`), ISBN lookup (`axios` + Google Books / Open Library APIs) | ✅ |
| 21 | `catalog.service.ts` + routes | Book CRUD, ISBN auto-fill, Meilisearch indexing/search, copy management (book_inventory), barcode assignment | ✅ |

---

### Group E: Circulation

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 22 | `circulation.service.ts` | Checkout, return (3-stage: `returned` → `being_processed` → `shelved`), renewal, hold queue with position tracking | ✅ |
| 23 | Circulation HTTP routes | `POST /api/v1/circulation/checkout`, `/return`, `/return/advance`, `/renew`, `/holds`; `DELETE /holds/:id`; `GET /my/checkouts`, `/my/holds`, `/shelving-queue` | ✅ |

---

### Group F: Student Web Portal (`apps/web`)

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 24 | Auth pages | Login page (auto-detect: email vs student ID+PIN), logout, session persistence via Zustand | ✅ |
| 25 | Catalog search UI | Search bar with Meilisearch, faceted filters (genre, level, availability, language), book cards with cover images | ✅ |
| 26 | Book detail page | Full book info, availability status, hold button, related books | ✅ |
| 27 | My account page | Active checkouts, due dates, hold queue position, renewal button, reading history | ✅ |
| 28 | Barcode scanner | Camera-based scanning via Quagga2/ZXing for student self-checkout | ✅ |
| 29 | PWA setup | Service Worker, offline cache, installable manifest, IndexedDB local catalog snapshot | ✅ |

---

### Group G: Staff Dashboard (`apps/admin`)

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 30 | Admin auth + routing | Login page, JWT session, role-based route guards (librarian / admin / library_assistant views) | ✅ |
| 31 | Pending staff approvals UI | List of pending self-registrations, approve/reject buttons — uses `/api/v1/admin/staff/pending` | ✅ |
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
| 38 | Printing service + API routes | PDFKit spine/cover/card/bulk labels, bwip-js Code128+QR, ZPL for Zebra printers, barcode lookup route | ✅ |
| 39 | Barcode scanner + CirculationPage | @ericblade/quagga2 camera scanner, useBarcodeInput USB hook, CirculationPage with Checkout/Return tabs | ✅ |

---

## Phase 2 — Engagement ✅ COMPLETE (2026-06-01)

### Group J: Engagement Data Layer

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 40 | Phase 2 DB migrations | reading_lists, reading_list_items, book_clubs, book_club_members, badges, user_badges, challenges, challenge_progress, push_subscriptions | ✅ |
| 41 | Reading lists service + routes | Personal CRUD lists, add/remove books, to_read/reading/completed status | ✅ |
| 42 | Book clubs service + routes | Create clubs, join/leave, assign book, member management | ✅ |

### Group L: Student Portal UI (Engagement)

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 43 | Reading lists UI | My Lists page — create, add books, status toggle, detail view | ✅ |
| 44 | Book clubs UI | Browse/join clubs, club detail, member list, create club | ✅ |
| 45 | Badges + challenges UI | Achievement wall with emoji badges, challenge cards, progress bars, leaderboard | ✅ |

### Group M: AI + Push

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 46 | AI recommendations | Claude API (haiku) personalized book suggestions, Redis 24h cache | ✅ |
| 47 | FCM push notifications | Firebase Admin SDK, push_subscriptions table, service worker, scheduler integration | ✅ |

### Group K: Gamification

| # | Task | What it covers | Status |
|---|------|----------------|--------|
| 48 | Badges engine + routes | Auto-award engine (7 criteria), badge CRUD, hooks into checkout/club/list events | ✅ |
| 49 | Challenges service + routes | CRUD, enrollment, progress tracking on checkout, leaderboard | ✅ |

---

## Phase 3 — Admin & Analytics

| Feature | What it covers |
|---------|----------------|
| Reports dashboard | Circulation stats, top borrowed books, overdue by grade |
| Grafana dashboards | Prometheus metrics, real-time monitoring |
| Bulk CSV import | Student roster import, book catalog mass upload |
| Multi-tenancy | School switcher, isolated data, shared infra |
| MARC import | Recover existing Follett Destiny catalog data |

---

## Phase 4 — Advanced

| Feature | What it covers |
|---------|----------------|
| LDAP / SSO | Google Workspace login for staff |
| RFID support | Web USB API, HF 13.56 MHz ISO 15693 |
| AI catalog entry | Paste ISBN/title → Claude auto-fills all metadata |
| Kiosk mode | Attract screen, touchscreen UI, auto-logout |
| Multi-language | Filipino/Tagalog i18n via react-i18next |

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Tasks completed (Groups A–K) | **49** |
| Tasks remaining Phase 2 | **0** |
| Test files | 42 |
| Tests passing | 329 |
| API endpoints live | 50+ |
| DB tables | 20 |

---

## Completed Endpoints

| Method | Path | What it does |
|--------|------|--------------|
| GET | `/health` | Health check |
| POST | `/api/v1/auth/login` | Login (email+password or studentID+PIN) |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/register` | Staff self-registration (pending approval) |
| POST | `/api/v1/auth/verify-email` | Consume email verification token |
| POST | `/api/v1/auth/set-password` | Set password from invite token |
| GET | `/api/v1/admin/staff/pending` | List pending staff registrations |
| POST | `/api/v1/admin/staff/:id/approve` | Approve staff account |
| POST | `/api/v1/admin/staff/:id/reject` | Reject staff account |
| POST | `/api/v1/admin/staff` | Admin creates staff account (sends invite) |
