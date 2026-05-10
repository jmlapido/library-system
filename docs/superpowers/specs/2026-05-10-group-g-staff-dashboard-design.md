# Group G: Staff Admin Dashboard — Design Spec

**Date:** 2026-05-10  
**Status:** Approved  
**Scope:** `apps/admin` — Tasks 30–34 + extra permissions system + audit log  

---

## Overview

Build the staff-facing admin dashboard (`apps/admin`) as a React 18 + Vite SPA using Tailwind CSS + shadcn/ui + TanStack Table + TanStack Query. Covers auth, role-based routing, circulation desk, catalog management (with archive), staff management + granular permissions, student roster, and an audit log.

---

## 1. Architecture & Project Setup

### Dependencies to add

```
# Runtime
react-router-dom            # v6, matches apps/web
zustand                     # auth store (same pattern as apps/web)
@tanstack/react-query       # server state — loading, caching, mutation invalidation
react-hook-form             # book add/edit form
@hookform/resolvers         # zod integration

# Tailwind + shadcn/ui
tailwindcss autoprefixer postcss
# shadcn/ui components (via CLI): Button, Input, Table, Dialog, Badge,
# Tabs, Toast, Select, Card, Label, Separator, Checkbox

# Already installed
@tanstack/react-table       ✓
@radix-ui/react-slot        ✓
```

### Folder structure

```
apps/admin/src/
├── components/
│   ├── AppShell.tsx              # sidebar + header wrapper
│   ├── ProtectedRoute.tsx        # role + permission guard
│   └── ui/                       # shadcn generated components
├── features/
│   ├── auth/                     # LoginPage, auth store
│   ├── staff-management/         # PendingList, ActiveStaff, PermissionsDialog
│   ├── circulation/              # DeskPage, BarcodeInput, ScanCamera, ShelvingQueue
│   ├── catalog/                  # BookList, BookForm, CopyManager, ArchiveTab
│   ├── students/                 # StudentList, ResetPinDialog, EditEmailDialog
│   └── audit-log/                # AuditLogPage
├── hooks/
│   └── usePermission.ts          # checks role defaults + granted extras
├── lib/
│   ├── api.ts                    # typed fetch wrapper (adapted from apps/web)
│   └── query-client.ts           # TanStack QueryClient singleton
├── stores/
│   └── auth.ts                   # Zustand persist (librams-admin-auth key)
├── router.tsx
└── App.tsx
```

### Sidebar navigation (role-filtered)

| Nav item | library_assistant | librarian | admin |
|---|---|---|---|
| Circulation Desk | ✓ | ✓ | ✓ |
| Shelving Queue | ✓ | ✓ | ✓ |
| Catalog | perm-gated | ✓ | ✓ |
| Staff Management | — | ✓ | ✓ |
| Students | perm-gated | ✓ | ✓ |
| Audit Log | — | — | ✓ |

Sidebar shows user name + role badge at bottom, Sign Out button. Unauthorized direct-URL access redirects to `/` + toast "Access denied."

---

## 2. Task 30 — Admin Auth + Role-Based Routing

### Login page

Staff-only: email + password (no student ID/PIN auto-detect). Error states mapped from API codes:

| Code | Message shown |
|---|---|
| `APPROVAL_PENDING` | "Your account is awaiting admin approval" |
| `ACCOUNT_INACTIVE` | "Your account has been deactivated" |
| `EMAIL_NOT_VERIFIED` | "Check your email to verify your account" |

JWT stored in Zustand, persisted to `localStorage` key `librams-admin-auth` (separate from `librams-auth` used by the student portal).

### Route tree

```
/login                    public — redirects to /circulation if authed
/                         redirects to first permitted page by role
/circulation              roles: all staff
/shelving-queue           roles: all staff
/catalog                  roles: librarian, admin + library_assistant with perm
/catalog/new              roles: librarian, admin + library_assistant with catalog.create
/catalog/:id/edit         roles: librarian, admin + library_assistant with catalog.edit
/staff-management         roles: librarian, admin
/students                 roles: librarian, admin + library_assistant with students.view
/audit-log                roles: admin only
```

### Role redirect on login

| Role | Redirects to |
|---|---|
| `library_assistant` | `/circulation` |
| `librarian` | `/circulation` |
| `admin` | `/staff-management` (approving new staff is first action) |

### ProtectedRoute

Checks: (1) authenticated, (2) role allowed OR permission granted. Unauthorized → redirect to `/` + toast.

---

## 3. Task 31 — Staff Management UI (Pending + Active)

### Page layout — two tabs: Pending | Active Staff

**Pending tab** (existing behavior):

TanStack Table of pending self-registrations. Columns: Name, Email, Role, Registered, Actions.

- **Approve** → `POST /api/v1/admin/staff/:id/approve` → mutation invalidates pending list → row disappears
- **Reject** → Dialog with optional rejection reason → `POST /api/v1/admin/staff/:id/reject`
- Empty state: "No pending registrations"

**Active Staff tab:**

TanStack Table of all approved staff. Columns: Name, Email, Role, Actions.

- **Manage Permissions** (admin only) → `PermissionsDialog`

**Create Staff Account** button (admin only, top-right):
- Dialog: Name, Email, Role (Select: librarian / library_assistant / admin)
- `POST /api/v1/admin/staff` → sends invite email with set-password link
- Success toast: "Invite sent to [email]"

### PermissionsDialog

Checklist of all grantable permissions. Permissions already included in the user's role are shown checked + greyed out with tooltip "Included in [role] role". Extras are toggleable.

- Save → `PATCH /api/v1/admin/staff/:id/permissions`
- Audit log entry written on every change: `permissions.grant` / `permissions.revoke`

---

## 4. Task 32 — Circulation Desk UI

### Page layout

Tab switcher: **Checkout** | **Return**. Both use the same `BarcodeInput` component.

### BarcodeInput component

Focused `<input>` that recaptures focus after each scan (USB scanner fires Enter → triggers action). "Use Camera" toggle opens Quagga2 scanner overlay (reuses `@ericblade/quagga2` already in the workspace).

### Checkout flow

1. Scan student barcode → fetch student name → confirmation chip displayed
2. Scan book barcode → `POST /api/v1/circulation/checkout` → success toast: "[Title] — due [date]"
3. Input clears, focus returns — ready for next book
4. Student barcode stays set until manually cleared or a new student barcode is scanned (multiple books per student without re-scanning)

### Return flow

1. Scan student barcode → fetch student name → confirmation chip displayed
2. Scan book barcode → `POST /api/v1/circulation/return` → shows book title + status badge (`returned` / `being_processed` / `shelved`)
3. Input clears, focus returns — ready for next book
4. Student barcode stays set until manually cleared or a new student barcode is scanned (multiple books per student without re-scanning)

### Error handling (inline, not toast — stays visible)

| Error | Message |
|---|---|
| Unknown barcode | "Barcode not found" |
| Book already checked out | "Already checked out to [name]" |
| Student not found | "Student ID not recognised" |

### Shelving Queue (`/shelving-queue`)

TanStack Table: items with status `returned` or `being_processed`, sorted by return date. Columns: Title, Barcode, Status, Returned at, Action.

"Advance" button → `POST /api/v1/circulation/return/advance` → status badge updates via query invalidation.

---

## 5. Task 33 — Catalog Management UI

### Page layout

TanStack Table with debounced search bar (`GET /api/v1/catalog/books?q=...`). Two tabs: **Active** | **Archived**. "Add Book" button top-right.

Columns (Active): Cover thumbnail, Title, Author, ISBN, Copies (available/total), Actions (Edit, Archive).  
Columns (Archived): Cover thumbnail, Title, Author, ISBN, Archived date, Actions (Restore).

### Add/Edit book form (react-hook-form + zod)

**ISBN auto-fill**: type or scan ISBN → "Look up" → `GET /api/v1/catalog/isbn/:isbn` → pre-fills all fields. Staff can override.

Fields: ISBN, Title, Author, Publisher, Year, Genre (Select), Description (textarea), Cover URL, Language (Select: English / Filipino).

- Create: `POST /api/v1/catalog/books`
- Update: `PATCH /api/v1/catalog/books/:id`

**Copies sub-section** (below form fields):
- Lists existing copies: barcode, condition badge, status badge
- "Add Copy" → inline row: barcode input + condition Select → `POST /api/v1/catalog/books/:id/copies`
- Delete copy → `DELETE /api/v1/catalog/books/:id/copies/:copyId`

### Archive / Restore

- **Archive** → confirm Dialog → `POST /api/v1/catalog/books/:id/archive` → sets `archived_at` timestamp → row moves to Archived tab
- **Restore** → `POST /api/v1/catalog/books/:id/restore` → clears `archived_at` → row moves back to Active tab
- Hard delete removed — no permanent deletion from UI (preserves checkout history integrity)

### Required DB migration

New nullable column on `books` table: `archived_at TIMESTAMPTZ`.  
`GET /api/v1/catalog/books` excludes archived by default; `?archived=true` returns archived only.  
New API routes: `POST /catalog/books/:id/archive`, `POST /catalog/books/:id/restore`.

---

## 6. Task 34 — Student Roster + New API Endpoints

### New API endpoints

All guarded by `requireAuth + requireRole('librarian', 'admin')`.

```
GET   /api/v1/admin/students                  list students (paginated, searchable)
PATCH /api/v1/admin/students/:id              update student (add/remove email)
POST  /api/v1/admin/students/:id/reset-pin    reset PIN → returns plaintext PIN once
```

Reset PIN: bcrypt hash (cost 12) stored in DB. Plaintext PIN returned in response once, never stored or logged.

### Student Roster page

TanStack Table with search bar. Columns: Name, Student ID, Email (or "—"), Grade, Actions.

**Reset PIN** → confirm Dialog → `POST /api/v1/admin/students/:id/reset-pin` → modal:
> "New PIN: **4829** — show this to the student, then close."  
> Button: "I've noted this down — Close"

PIN modal closes → PIN is gone from UI. Audit log entry: `students.reset_pin`.

**Add/Remove Email** → Dialog:
- No email: input to add one (enables email+password login)
- Has email: shows current email + "Remove" button (reverts to PIN-only)
- `PATCH /api/v1/admin/students/:id`
- Audit log entry: `students.edit_email`

---

## 7. Extra Permissions System

### DB: new `user_permissions` table

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id) ON DELETE CASCADE
permission  permission_enum NOT NULL
granted_by  UUID REFERENCES users(id)
granted_at  TIMESTAMPTZ DEFAULT NOW()
UNIQUE(user_id, permission)
```

### Permission enum

```
catalog.view · catalog.create · catalog.edit · catalog.archive · catalog.manage_copies
students.view · students.reset_pin · students.edit_email
staff.view · staff.approve · staff.reject
```

### Role floors (hardcoded, not in DB)

| Role | Default permissions |
|---|---|
| `library_assistant` | circulation + shelving only |
| `librarian` | all permissions above |
| `admin` | all permissions + `staff.create` |

Permissions are **additive only** — extras raise the floor, nothing can lower it.

### `/me` endpoint update

Returns `effectivePermissions: string[]` — role defaults merged with granted extras.

### `usePermission` hook

```ts
usePermission('catalog.view') // true if role includes it OR extra permission granted
```

### API endpoints

```
GET   /api/v1/admin/staff/:id/permissions    get user's granted extras
PATCH /api/v1/admin/staff/:id/permissions    set extras (admin only)
```

---

## 8. Audit Log

### Wiring

Log entries written inside service methods across: auth, staff, catalog, circulation, students, permissions services.

Every entry: `user_id · action · entity_type · entity_id · metadata (JSONB) · ip_address · created_at`.

### Actions logged

| Category | Actions |
|---|---|
| Auth | `auth.login` · `auth.logout` |
| Staff | `staff.approve` · `staff.reject` · `staff.create` |
| Catalog | `catalog.create_book` · `catalog.edit_book` · `catalog.archive_book` · `catalog.restore_book` · `catalog.add_copy` · `catalog.delete_copy` |
| Circulation | `circulation.checkout` · `circulation.return` · `circulation.advance_shelving` |
| Students | `students.reset_pin` · `students.edit_email` |
| Permissions | `permissions.grant` · `permissions.revoke` |

### Audit Log page (`/audit-log`, admin only)

TanStack Table with filters: date range, action type, staff member. Columns: Staff, Action, Record, When.

New API endpoint:
```
GET /api/v1/admin/audit-log?page=&limit=&action=&userId=&from=&to=
```
Guarded by `requireRole('admin')`.

---

## 9. Testing

### Frontend (Vitest + React Testing Library)

- `ProtectedRoute` — unauthenticated redirect, wrong role redirect, renders for correct role
- `usePermission` — role-default true, granted extra true, absent false
- `BarcodeInput` — fires callback on Enter, clears after success
- Auth store — setSession, logout, persistence
- Login page — all three error code messages render correctly
- Staff Management — approve removes row, reject opens dialog
- Catalog — ISBN lookup pre-fills form, archive moves to Archived tab, restore moves back
- Circulation desk — student scan → book scan → toast → input cleared

### API (Vitest)

- `GET /admin/students` — paginated, excludes non-students
- `POST /admin/students/:id/reset-pin` — stores hash, returns plaintext once
- `PATCH /admin/students/:id` — add/remove email validation
- `GET /catalog/books?archived=true` — returns only archived
- `POST /catalog/books/:id/archive` — sets `archived_at`, excluded from default search
- `POST /catalog/books/:id/restore` — clears `archived_at`
- `PATCH /admin/staff/:id/permissions` — stores extras, returns merged effective permissions
- `GET /admin/audit-log` — filtered, paginated, admin-only

---

## Summary of New API Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/admin/students` | librarian, admin |
| PATCH | `/api/v1/admin/students/:id` | librarian, admin |
| POST | `/api/v1/admin/students/:id/reset-pin` | librarian, admin |
| POST | `/api/v1/catalog/books/:id/archive` | librarian, admin, library_assistant† |
| POST | `/api/v1/catalog/books/:id/restore` | librarian, admin, library_assistant† |
| GET | `/api/v1/admin/staff/:id/permissions` | admin |
| PATCH | `/api/v1/admin/staff/:id/permissions` | admin |
| GET | `/api/v1/admin/audit-log` | admin |

† with `catalog.archive` permission

## Summary of DB Migrations

| Migration | Change |
|---|---|
| `add_archived_at_to_books` | `books.archived_at TIMESTAMPTZ NULL` |
| `create_user_permissions` | new `user_permissions` table + `permission_enum` |
| `create_audit_log_indexes` | indexes on `audit_log(user_id, created_at, action)` |
