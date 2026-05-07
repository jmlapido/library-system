# Staff Registration & Approval — Design Spec

**Date:** 2026-05-07
**Task:** 19
**Status:** Approved

---

## Overview

Implements the two staff account creation paths plus email verification, using real SendGrid email delivery. Admin approval is required for self-registered staff before they can log in.

**Scope:**
- Option B: Staff self-registers → admin approves → email verify → login
- Option A: Admin creates staff account → email invite → staff sets password → login
- Rejection notification email for denied self-registrations
- Login guard: blocks login if email not verified or approval pending/rejected

**Out of scope (future tasks):**
- Password reset flow (Task 21) — `verification_tokens` table is ready for it
- Admin PIN reset for students (Task 22)
- Frontend UI for approval queue (Task 38)

---

## Schema Changes

### Migration 1 — `approval_status` on users

```sql
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
ALTER TABLE users
  ADD COLUMN approval_status approval_status NOT NULL DEFAULT 'approved';
```

Default `'approved'` preserves existing rows (students, seeded admins).
Self-registering staff explicitly set `'pending'`.

### Migration 2 — `verification_tokens` table

```sql
CREATE TABLE verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  type        VARCHAR(50) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX verification_tokens_user_id_idx ON verification_tokens(user_id);
```

**Token types used in this task:**
| Type | Expiry | Purpose |
|------|--------|---------|
| `email_verify` | 24h | Sent after admin approves self-registered staff |
| `staff_invite` | 72h | Sent when admin creates a staff account |
| `password_reset` | 1h | Reserved — table ready, endpoint in Task 21 |

Tokens are 32 random bytes stored as hex strings. Stored in DB as SHA-256 hash (not bcrypt — tokens are long enough; speed matters for link clicks).

---

## API Endpoints

### Public (no auth required)

| Method | Path | Body | Success |
|--------|------|------|---------|
| `POST` | `/api/v1/auth/register` | `{ email, password, fullName, role, schoolId }` | 201 |
| `POST` | `/api/v1/auth/verify-email` | `{ token }` | 200 |
| `POST` | `/api/v1/auth/set-password` | `{ token, password }` | 200 |

**Register constraints:**
- `role` must be one of: `teacher`, `librarian`, `library_assistant` — students cannot self-register
- `password` min 8 characters
- Duplicate email → 409 `EMAIL_ALREADY_EXISTS`

### Admin (requireAuth + requireRole('admin', 'librarian'))

| Method | Path | Body | Success |
|--------|------|------|---------|
| `GET` | `/api/v1/admin/staff/pending` | — | 200 + array |
| `POST` | `/api/v1/admin/staff/:id/approve` | — | 200 |
| `POST` | `/api/v1/admin/staff/:id/reject` | — | 200 |
| `POST` | `/api/v1/admin/staff` | `{ email, fullName, role, schoolId }` | 201 |

**Response envelope (all endpoints):**
```json
{ "success": true, "data": {}, "message": "..." }
{ "success": false, "error": "...", "code": "SCREAMING_SNAKE_CASE" }
```

---

## Service Layer

### `email.service.ts`

SendGrid wrapper. Reads `SENDGRID_API_KEY` and `EMAIL_FROM` from env. Throws `AppError('EMAIL_SEND_FAILED', ...)` on delivery failure.

```
sendVerificationEmail(to: string, verifyUrl: string): Promise<void>
sendStaffInviteEmail(to: string, inviteUrl: string, fullName: string): Promise<void>
sendRejectionEmail(to: string, fullName: string): Promise<void>
```

Email content: plain-text + minimal HTML. No external template engine.

### `token.service.ts`

Verification token lifecycle. All operations throw `AppError('TOKEN_INVALID', ...)` on failure.

```
createToken(userId: string, type: TokenType, expiresInHours: number): Promise<string>
  → returns raw hex token, stores SHA-256 hash in DB

consumeToken(rawToken: string, expectedType: TokenType): Promise<{ userId: string }>
  → validates type, expiry, not-yet-used; marks used_at; returns userId
```

### `staff.service.ts`

Staff account management. Composes `token.service` and `email.service`.

```
registerStaff(input)
  → creates user: approvalStatus=pending, isActive=false, emailVerified=false
  → throws EMAIL_ALREADY_EXISTS on duplicate

approveStaff(userId)
  → throws STAFF_NOT_FOUND if user not found or approvalStatus !== 'pending'
  → sets approvalStatus=approved, isActive=true
  → createToken(userId, 'email_verify', 24)
  → sendVerificationEmail(email, APP_URL + /auth/verify-email?token=...)

rejectStaff(userId)
  → throws STAFF_NOT_FOUND if user not found or approvalStatus !== 'pending'
  → sets approvalStatus=rejected
  → sendRejectionEmail(email, fullName)

createStaffByAdmin(input)
  → creates user: approvalStatus=approved, isActive=true, emailVerified=false, passwordHash=null
  → createToken(userId, 'staff_invite', 72)
  → sendStaffInviteEmail(email, APP_URL + /auth/set-password?token=..., fullName)

verifyEmail(rawToken)
  → consumeToken(rawToken, 'email_verify') → userId
  → sets emailVerified=true

setPasswordFromInvite(rawToken, password)
  → consumeToken(rawToken, 'staff_invite') → userId
  → bcrypt.hash(password, 12) → sets passwordHash, emailVerified=true
```

### `auth.service.ts` — login() additions

After credential check, add two guards:
```
if (!user.emailVerified)          → throw AppError('EMAIL_NOT_VERIFIED', ...)
if (user.approvalStatus === 'pending')  → throw AppError('APPROVAL_PENDING', ...)
if (user.approvalStatus === 'rejected') → throw AppError('ACCOUNT_INACTIVE', ...)
```

---

## File Structure

```
apps/api/src/
  services/
    email.service.ts        ← new
    token.service.ts        ← new
    staff.service.ts        ← new
  controllers/
    staff.controller.ts     ← new
  routes/
    staff.ts                ← new (admin routes)
  __tests__/
    token.service.test.ts   ← new
    staff.service.test.ts   ← new
    staff.routes.test.ts    ← new
  db/schema/
    users.ts                ← add approvalStatus column
    sessions.ts             ← add verification_tokens table
  db/migrations/
    0002_*.sql              ← approvalStatus enum + column
    0003_*.sql              ← verification_tokens table
  index.ts                  ← mount /api/v1/admin/staff router
                            ← mount /api/v1/auth/register, verify-email, set-password
```

---

## Environment Variables

Add to `.env` and `.env.example`:
```
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@yourdomain.com
APP_URL=http://localhost:3000
```

Add test values to `vitest.config.ts`:
```
SENDGRID_API_KEY=test-key
EMAIL_FROM=noreply@test.com
APP_URL=http://localhost:3000
```

---

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `EMAIL_ALREADY_EXISTS` | 409 | Duplicate email on register |
| `INVALID_ROLE` | 422 | Student role attempted on register |
| `TOKEN_INVALID` | 400 | Expired, used, wrong-type, or not-found token |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked — email not verified |
| `APPROVAL_PENDING` | 403 | Login blocked — awaiting admin approval |
| `ACCOUNT_INACTIVE` | 403 | Login blocked — rejected or deactivated |
| `EMAIL_SEND_FAILED` | 502 | SendGrid delivery failure |
| `STAFF_NOT_FOUND` | 404 | Admin action on unknown user ID |

---

## Testing Plan

**SendGrid mocked** in all tests via `vi.mock('../services/email.service.js')`.

**`token.service.test.ts`:**
- `createToken` stores hash, not raw token
- `consumeToken` succeeds on valid token
- `consumeToken` throws on expired token
- `consumeToken` throws on already-used token
- `consumeToken` throws on wrong type

**`staff.service.test.ts`:**
- `registerStaff` creates user with `pending`/`isActive=false`
- `registerStaff` throws on duplicate email
- `registerStaff` throws on student role
- `approveStaff` sets approved/active, calls sendVerificationEmail
- `rejectStaff` sets rejected, calls sendRejectionEmail
- `createStaffByAdmin` creates approved/active, calls sendStaffInviteEmail
- `verifyEmail` marks emailVerified=true
- `setPasswordFromInvite` sets passwordHash + emailVerified=true

**`staff.routes.test.ts`:**
- `POST /auth/register` → 201 valid, 409 duplicate, 422 student role
- `POST /auth/verify-email` → 200 valid, 400 expired/used
- `POST /auth/set-password` → 200 valid, 400 invalid token
- `GET /admin/staff/pending` → 401 no token, 403 non-admin, 200 list
- `POST /admin/staff/:id/approve` → 200, subsequent login returns EMAIL_NOT_VERIFIED
- `POST /admin/staff/:id/reject` → 200, subsequent login returns ACCOUNT_INACTIVE
- `POST /admin/staff` → 201, invite sent

**`auth.service.test.ts` additions:**
- Login throws `EMAIL_NOT_VERIFIED` when emailVerified=false
- Login throws `APPROVAL_PENDING` when approvalStatus=pending
- Login throws `ACCOUNT_INACTIVE` when approvalStatus=rejected
