# Staff Registration & Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement staff self-register → admin approval → email verify flow, plus admin-creates-staff invite flow, using real SendGrid email delivery.

**Architecture:** Split across three new services (`email.service`, `token.service`, `staff.service`) following the existing flat service/controller/routes pattern. Two DB migrations add `approval_status` enum to `users` and a new `verification_tokens` table. Login guards are added to the existing `auth.service.login()`.

**Tech Stack:** Hono, Drizzle ORM, PostgreSQL, bcryptjs, @sendgrid/mail, Vitest, Zod

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `packages/shared/src/schemas/auth.schema.ts` | Add `password` to RegisterStaffSchema; add VerifyEmailSchema, SetPasswordSchema, CreateStaffByAdminSchema |
| Modify | `apps/api/src/db/schema/users.ts` | Add `approvalStatusEnum` + `approvalStatus` column |
| Create | `apps/api/src/db/schema/verificationTokens.ts` | `verification_tokens` table schema |
| Modify | `apps/api/src/db/schema/index.ts` | Export `verificationTokens` |
| Create | `apps/api/src/db/migrations/0002_*.sql` | approvalStatus migration (auto-generated) |
| Create | `apps/api/src/db/migrations/0003_*.sql` | verification_tokens migration (auto-generated) |
| Create | `apps/api/src/services/email.service.ts` | SendGrid wrapper |
| Create | `apps/api/src/services/token.service.ts` | Token create/consume lifecycle |
| Create | `apps/api/src/services/staff.service.ts` | Register, approve, reject, create, verify |
| Modify | `apps/api/src/services/auth.service.ts` | Add approvalStatus/emailVerified login guards |
| Create | `apps/api/src/controllers/staff.controller.ts` | HTTP handlers for staff routes |
| Create | `apps/api/src/routes/staff.ts` | Auth register/verify + admin staff routes |
| Modify | `apps/api/src/index.ts` | Mount staff router |
| Modify | `apps/api/vitest.config.ts` | Add SENDGRID_API_KEY, EMAIL_FROM, APP_URL |
| Modify | `.env` + `.env.example` | Add SendGrid env vars |
| Create | `apps/api/src/__tests__/email.service.test.ts` | Unit tests (SendGrid mocked) |
| Create | `apps/api/src/__tests__/token.service.test.ts` | Integration tests (real DB) |
| Create | `apps/api/src/__tests__/staff.service.test.ts` | Integration tests (real DB, email mocked) |
| Create | `apps/api/src/__tests__/staff.routes.test.ts` | HTTP integration tests |
| Modify | `apps/api/src/__tests__/auth.service.test.ts` | Add 3 new login guard test cases |

---

## Task 1: Feature Branch + Shared Schema Updates

**Files:**
- Modify: `packages/shared/src/schemas/auth.schema.ts`

- [ ] **Step 1: Create feature branch**

```bash
cd librams
git checkout -b feature/task-19-staff-registration
```

- [ ] **Step 2: Update `auth.schema.ts` — add missing `password` field and new schemas**

Replace the entire file content:

```typescript
import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string().min(1),
  credential: z.string().min(1),
});

export const RegisterStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(255),
  role: z.enum(['teacher', 'librarian', 'library_assistant']),
  schoolId: z.string().uuid(),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(64),
});

export const SetPasswordSchema = z.object({
  token: z.string().min(64),
  password: z.string().min(8).max(128),
});

export const CreateStaffByAdminSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: z.enum(['teacher', 'librarian', 'library_assistant']),
  schoolId: z.string().uuid(),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterStaffInput = z.infer<typeof RegisterStaffSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
export type CreateStaffByAdminInput = z.infer<typeof CreateStaffByAdminSchema>;
```

- [ ] **Step 3: Verify shared package still builds**

```bash
pnpm --filter shared typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/auth.schema.ts
git commit -m "feat(shared): add password to RegisterStaffSchema, add VerifyEmail/SetPassword/CreateStaffByAdmin schemas"
```

---

## Task 2: DB Schema — approvalStatus + verification_tokens

**Files:**
- Modify: `apps/api/src/db/schema/users.ts`
- Create: `apps/api/src/db/schema/verificationTokens.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Add `approvalStatusEnum` and column to `users.ts`**

Replace the file:

```typescript
import { pgTable, uuid, varchar, integer, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { schools } from './schools.js';

export const userRoleEnum = pgEnum('user_role', [
  'student',
  'teacher',
  'librarian',
  'library_assistant',
  'admin',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  studentId: varchar('student_id', { length: 100 }).unique(),
  pinHash: varchar('pin_hash', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  gradeLevel: integer('grade_level'),
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  isActive: boolean('is_active').default(true).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  approvalStatus: approvalStatusEnum('approval_status').default('approved').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('users_school_id_idx').on(table.schoolId),
  index('users_role_idx').on(table.role),
  index('users_approval_status_idx').on(table.approvalStatus),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 2: Create `apps/api/src/db/schema/verificationTokens.ts`**

```typescript
import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('verification_tokens_user_id_idx').on(table.userId),
]);

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
```

- [ ] **Step 3: Export from `apps/api/src/db/schema/index.ts`**

```typescript
export * from './users.js';
export * from './schools.js';
export * from './books.js';
export * from './circulation.js';
export * from './sessions.js';
export * from './verificationTokens.js';
```

- [ ] **Step 4: Generate migrations**

```bash
cd librams
pnpm db:generate
```

Expected: two new migration files created under `apps/api/src/db/migrations/`

- [ ] **Step 5: Verify Docker is running, then apply migrations**

```bash
docker compose ps
pnpm db:migrate
```

Expected: `All migrations applied successfully` (or similar Drizzle output)

- [ ] **Step 6: Verify schema in DB**

```bash
docker exec -it librams-db-1 psql -U librams -d librams -c "\d users" 2>/dev/null || docker exec -it $(docker ps --filter name=postgres -q | head -1) psql -U librams -d librams -c "\d users"
```

Expected: `approval_status` column visible with type `approval_status`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/schema/ apps/api/src/db/migrations/
git commit -m "feat(api/db): add approvalStatus to users, add verification_tokens table"
```

---

## Task 3: email.service.ts (TDD)

**Files:**
- Create: `apps/api/src/__tests__/email.service.test.ts`
- Create: `apps/api/src/services/email.service.ts`

- [ ] **Step 1: Install @sendgrid/mail**

```bash
cd librams
pnpm --filter api add @sendgrid/mail
pnpm --filter api add -D @types/sendgrid__mail
```

Expected: package added to `apps/api/package.json`

Note: `@sendgrid/mail` ships its own types, so `@types/` package may not exist — that's fine, skip it if install fails.

- [ ] **Step 2: Write failing tests — `apps/api/src/__tests__/email.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}));

import sgMail from '@sendgrid/mail';
import {
  sendVerificationEmail,
  sendStaffInviteEmail,
  sendRejectionEmail,
} from '../services/email.service.js';

describe('email.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('sendVerificationEmail', () => {
    it('sends to correct recipient with verify subject', async () => {
      await sendVerificationEmail('staff@school.com', 'http://localhost:3000/auth/verify-email?token=abc');
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'staff@school.com',
          subject: expect.stringContaining('Verify'),
        })
      );
    });

    it('includes the verify URL in email body', async () => {
      const url = 'http://localhost:3000/auth/verify-email?token=abc123';
      await sendVerificationEmail('staff@school.com', url);
      const call = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.text).toContain(url);
    });
  });

  describe('sendStaffInviteEmail', () => {
    it('sends invite with staff name and invite URL', async () => {
      await sendStaffInviteEmail('new@school.com', 'http://localhost:3000/auth/set-password?token=xyz', 'Maria Cruz');
      const call = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.to).toBe('new@school.com');
      expect(call.text).toContain('Maria Cruz');
      expect(call.text).toContain('set-password?token=xyz');
    });
  });

  describe('sendRejectionEmail', () => {
    it('sends rejection to correct recipient', async () => {
      await sendRejectionEmail('rejected@school.com', 'Juan Dela Cruz');
      const call = (sgMail.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.to).toBe('rejected@school.com');
      expect(call.text).toContain('Juan Dela Cruz');
    });
  });
});
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/email.service.test.ts
```

Expected: `FAIL` — `email.service.js` not found

- [ ] **Step 4: Implement `apps/api/src/services/email.service.ts`**

```typescript
import sgMail from '@sendgrid/mail';
import { AppError } from './auth.service.js';

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) throw new Error('SENDGRID_API_KEY is not set');
sgMail.setApiKey(apiKey);

const FROM = process.env.EMAIL_FROM ?? 'noreply@libraryms.com';

/**
 * Send email verification link to newly approved staff.
 * @param to - Recipient email address.
 * @param verifyUrl - Full URL with token query param.
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  try {
    await sgMail.send({
      to,
      from: FROM,
      subject: 'Verify your LibraMS account',
      text: `Your account has been approved. Verify your email:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Your account has been approved.</p><p><a href="${verifyUrl}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
    });
  } catch {
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send verification email');
  }
}

/**
 * Send invite email to staff account created by admin.
 * @param to - Recipient email address.
 * @param inviteUrl - Full URL with token query param for setting password.
 * @param fullName - Staff member's full name for personalisation.
 */
export async function sendStaffInviteEmail(to: string, inviteUrl: string, fullName: string): Promise<void> {
  try {
    await sgMail.send({
      to,
      from: FROM,
      subject: 'You have been invited to LibraMS',
      text: `Hi ${fullName},\n\nYou have been added to LibraMS. Set your password to get started:\n\n${inviteUrl}\n\nThis link expires in 72 hours.`,
      html: `<p>Hi ${fullName},</p><p>You have been added to LibraMS.</p><p><a href="${inviteUrl}">Set your password</a></p><p>This link expires in 72 hours.</p>`,
    });
  } catch {
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send invite email');
  }
}

/**
 * Notify rejected staff applicant of the decision.
 * @param to - Recipient email address.
 * @param fullName - Staff member's full name for personalisation.
 */
export async function sendRejectionEmail(to: string, fullName: string): Promise<void> {
  try {
    await sgMail.send({
      to,
      from: FROM,
      subject: 'Your LibraMS account request',
      text: `Hi ${fullName},\n\nYour account request was not approved. Please contact your school administrator for assistance.`,
      html: `<p>Hi ${fullName},</p><p>Your account request was not approved. Please contact your school administrator for assistance.</p>`,
    });
  } catch {
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send rejection email');
  }
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/email.service.test.ts
```

Expected: `3 tests passed`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/email.service.ts apps/api/src/__tests__/email.service.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api/email): add SendGrid email service with verification, invite, and rejection emails"
```

---

## Task 4: token.service.ts (TDD)

**Files:**
- Create: `apps/api/src/__tests__/token.service.test.ts`
- Create: `apps/api/src/services/token.service.ts`

- [ ] **Step 1: Write failing tests — `apps/api/src/__tests__/token.service.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { verificationTokens } from '../db/schema/index.js';
import { users, schools } from '../db/schema/index.js';
import { createToken, consumeToken } from '../services/token.service.js';
import { AppError } from '../services/auth.service.js';

let testUserId: string;

beforeAll(async () => {
  const [school] = await db.insert(schools).values({
    name: 'Token Test School',
    address: '1 Token St',
  }).returning({ id: schools.id });

  const [user] = await db.insert(users).values({
    email: `token-test-${Date.now()}@example.com`,
    passwordHash: 'hash',
    fullName: 'Token Test User',
    role: 'teacher',
    schoolId: school.id,
  }).returning({ id: users.id });

  testUserId = user.id;
});

afterAll(async () => {
  await db.delete(verificationTokens).where(eq(verificationTokens.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('createToken', () => {
  it('returns a raw hex token', async () => {
    const raw = await createToken(testUserId, 'email_verify', 24);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stores a hash — raw token is NOT in the database', async () => {
    const raw = await createToken(testUserId, 'email_verify', 24);
    const rows = await db.select().from(verificationTokens).where(eq(verificationTokens.userId, testUserId));
    const tokenRow = rows.find((r) => r.tokenHash === raw);
    expect(tokenRow).toBeUndefined();
  });
});

describe('consumeToken', () => {
  it('returns userId for a valid token', async () => {
    const raw = await createToken(testUserId, 'email_verify', 24);
    const result = await consumeToken(raw, 'email_verify');
    expect(result.userId).toBe(testUserId);
  });

  it('marks the token as used after consumption', async () => {
    const raw = await createToken(testUserId, 'email_verify', 24);
    await consumeToken(raw, 'email_verify');
    await expect(consumeToken(raw, 'email_verify')).rejects.toThrow(AppError);
  });

  it('throws TOKEN_INVALID on wrong type', async () => {
    const raw = await createToken(testUserId, 'email_verify', 24);
    await expect(consumeToken(raw, 'staff_invite')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('throws TOKEN_INVALID on expired token', async () => {
    const raw = await createToken(testUserId, 'email_verify', -1);
    await expect(consumeToken(raw, 'email_verify')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('throws TOKEN_INVALID on garbage input', async () => {
    await expect(consumeToken('not-a-real-token', 'email_verify')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/token.service.test.ts
```

Expected: `FAIL` — `token.service.js` not found

- [ ] **Step 3: Implement `apps/api/src/services/token.service.ts`**

```typescript
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { verificationTokens } from '../db/schema/index.js';
import { AppError } from './auth.service.js';

export type TokenType = 'email_verify' | 'staff_invite' | 'password_reset';

/**
 * Create a one-time verification token and store its SHA-256 hash.
 * @param userId - Owner of this token.
 * @param type - Token purpose (email_verify | staff_invite | password_reset).
 * @param expiresInHours - TTL in hours.
 * @returns Raw 64-char hex token to embed in the link URL.
 */
export async function createToken(userId: string, type: TokenType, expiresInHours: number): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');

  await db.insert(verificationTokens).values({
    userId,
    tokenHash: hash,
    type,
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
  });

  return raw;
}

/**
 * Validate and consume a one-time token. Marks it used so it cannot be reused.
 * @param rawToken - The raw hex token from the link URL.
 * @param expectedType - Expected token type; throws if mismatched.
 * @returns The userId the token belongs to.
 * @throws AppError TOKEN_INVALID if expired, used, wrong type, or not found.
 */
export async function consumeToken(rawToken: string, expectedType: TokenType): Promise<{ userId: string }> {
  const hash = createHash('sha256').update(rawToken).digest('hex');

  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hash),
        eq(verificationTokens.type, expectedType),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt),
      )
    )
    .limit(1);

  if (!token) throw new AppError('TOKEN_INVALID', 'Token is invalid, expired, or already used');

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, token.id));

  return { userId: token.userId };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/token.service.test.ts
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/token.service.ts apps/api/src/__tests__/token.service.test.ts
git commit -m "feat(api/auth): add verification token service with create/consume lifecycle"
```

---

## Task 5: staff.service.ts (TDD)

**Files:**
- Create: `apps/api/src/__tests__/staff.service.test.ts`
- Create: `apps/api/src/services/staff.service.ts`

- [ ] **Step 1: Write failing tests — `apps/api/src/__tests__/staff.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, schools, verificationTokens } from '../db/schema/index.js';
import {
  registerStaff,
  approveStaff,
  rejectStaff,
  createStaffByAdmin,
  verifyEmail,
  setPasswordFromInvite,
  listPendingStaff,
} from '../services/staff.service.js';
import { AppError } from '../services/auth.service.js';

vi.mock('../services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendStaffInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

import * as emailService from '../services/email.service.js';

let schoolId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db.insert(schools).values({
    name: 'Staff Service Test School',
    address: '2 Staff St',
  }).returning({ id: schools.id });
  schoolId = school.id;
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(verificationTokens).where(inArray(verificationTokens.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe('registerStaff', () => {
  it('creates a user with pending approval and isActive=false', async () => {
    await registerStaff({
      email: `register-test-${Date.now()}@school.com`,
      password: 'password123',
      fullName: 'Ana Reyes',
      role: 'teacher',
      schoolId,
    });

    const [user] = await db.select().from(users).where(eq(users.email, `register-test-${Date.now() - 100}@school.com`)).limit(1);
    // We query by approximate — instead, let's check via listing
    const pending = await listPendingStaff(schoolId);
    const found = pending.find((u) => u.fullName === 'Ana Reyes');
    expect(found).toBeDefined();
    if (found) createdUserIds.push(found.id);
  });

  it('throws EMAIL_ALREADY_EXISTS on duplicate email', async () => {
    const email = `dup-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Dup User', role: 'teacher', schoolId });
    const pending = await listPendingStaff(schoolId);
    const found = pending.find((u) => u.email === email);
    if (found) createdUserIds.push(found.id);

    await expect(
      registerStaff({ email, password: 'password123', fullName: 'Dup User 2', role: 'librarian', schoolId })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });
});

describe('approveStaff', () => {
  it('sets approvalStatus=approved, isActive=true, and sends verification email', async () => {
    const email = `approve-test-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Ben Santos', role: 'librarian', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);

    await approveStaff(user.id);

    const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.approvalStatus).toBe('approved');
    expect(updated.isActive).toBe(true);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(email, expect.stringContaining('verify-email'));
  });

  it('throws STAFF_NOT_FOUND when user does not exist', async () => {
    await expect(approveStaff('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      code: 'STAFF_NOT_FOUND',
    });
  });

  it('throws STAFF_NOT_FOUND when user is already approved', async () => {
    const email = `already-approved-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Already', role: 'teacher', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);
    await approveStaff(user.id);

    await expect(approveStaff(user.id)).rejects.toMatchObject({ code: 'STAFF_NOT_FOUND' });
  });
});

describe('rejectStaff', () => {
  it('sets approvalStatus=rejected and sends rejection email', async () => {
    const email = `reject-test-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Cora Lim', role: 'teacher', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);

    await rejectStaff(user.id);

    const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.approvalStatus).toBe('rejected');
    expect(emailService.sendRejectionEmail).toHaveBeenCalledWith(email, 'Cora Lim');
  });
});

describe('createStaffByAdmin', () => {
  it('creates approved+active user and sends invite email', async () => {
    const email = `admin-create-${Date.now()}@school.com`;
    const result = await createStaffByAdmin({ email, fullName: 'Dan Uy', role: 'library_assistant', schoolId });
    createdUserIds.push(result.id);

    const [user] = await db.select().from(users).where(eq(users.id, result.id)).limit(1);
    expect(user.approvalStatus).toBe('approved');
    expect(user.isActive).toBe(true);
    expect(user.emailVerified).toBe(false);
    expect(emailService.sendStaffInviteEmail).toHaveBeenCalledWith(email, expect.stringContaining('set-password'), 'Dan Uy');
  });
});

describe('verifyEmail', () => {
  it('sets emailVerified=true on valid token', async () => {
    const email = `verify-email-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Eve Go', role: 'teacher', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);
    await approveStaff(user.id);

    const [tokenRow] = await db.select().from(verificationTokens).where(eq(verificationTokens.userId, user.id)).limit(1);
    // We can't get the raw token from the hash — use createToken directly for test
    const { createToken } = await import('../services/token.service.js');
    const raw = await createToken(user.id, 'email_verify', 24);

    await verifyEmail(raw);

    const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.emailVerified).toBe(true);
  });
});

describe('setPasswordFromInvite', () => {
  it('sets passwordHash and emailVerified=true', async () => {
    const email = `set-pwd-${Date.now()}@school.com`;
    const result = await createStaffByAdmin({ email, fullName: 'Frank Lu', role: 'librarian', schoolId });
    createdUserIds.push(result.id);

    const { createToken } = await import('../services/token.service.js');
    const raw = await createToken(result.id, 'staff_invite', 72);

    await setPasswordFromInvite(raw, 'newpassword123');

    const [updated] = await db.select().from(users).where(eq(users.id, result.id)).limit(1);
    expect(updated.emailVerified).toBe(true);
    expect(updated.passwordHash).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/staff.service.test.ts
```

Expected: `FAIL` — `staff.service.js` not found

- [ ] **Step 3: Implement `apps/api/src/services/staff.service.ts`**

```typescript
import bcrypt from 'bcryptjs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { AppError } from './auth.service.js';
import { createToken, consumeToken } from './token.service.js';
import * as emailService from './email.service.js';
import type { RegisterStaffInput, CreateStaffByAdminInput } from 'shared';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Self-register a staff account. Sets approvalStatus=pending until an admin approves.
 * @throws AppError EMAIL_ALREADY_EXISTS if the email is taken.
 */
export async function registerStaff(input: RegisterStaffInput): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) throw new AppError('EMAIL_ALREADY_EXISTS', 'Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.insert(users).values({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    schoolId: input.schoolId,
    approvalStatus: 'pending',
    isActive: false,
    emailVerified: false,
  });
}

/**
 * Approve a pending staff account and send an email verification link.
 * @throws AppError STAFF_NOT_FOUND if user not found or not in pending state.
 */
export async function approveStaff(userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.approvalStatus !== 'pending') {
    throw new AppError('STAFF_NOT_FOUND', 'Staff member not found or not in pending state');
  }

  await db.update(users).set({ approvalStatus: 'approved', isActive: true }).where(eq(users.id, userId));

  const raw = await createToken(userId, 'email_verify', 24);
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${raw}`;
  await emailService.sendVerificationEmail(user.email!, verifyUrl);
}

/**
 * Reject a pending staff account and notify the applicant.
 * @throws AppError STAFF_NOT_FOUND if user not found or not in pending state.
 */
export async function rejectStaff(userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.approvalStatus !== 'pending') {
    throw new AppError('STAFF_NOT_FOUND', 'Staff member not found or not in pending state');
  }

  await db.update(users).set({ approvalStatus: 'rejected' }).where(eq(users.id, userId));
  await emailService.sendRejectionEmail(user.email!, user.fullName);
}

/**
 * Admin-creates a staff account and sends an invite email for password setup.
 * @throws AppError EMAIL_ALREADY_EXISTS if the email is taken.
 */
export async function createStaffByAdmin(input: CreateStaffByAdminInput): Promise<{ id: string }> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) throw new AppError('EMAIL_ALREADY_EXISTS', 'Email already registered');

  const [newUser] = await db.insert(users).values({
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    schoolId: input.schoolId,
    approvalStatus: 'approved',
    isActive: true,
    emailVerified: false,
  }).returning({ id: users.id });

  const raw = await createToken(newUser.id, 'staff_invite', 72);
  const inviteUrl = `${APP_URL}/auth/set-password?token=${raw}`;
  await emailService.sendStaffInviteEmail(input.email, inviteUrl, input.fullName);

  return { id: newUser.id };
}

/**
 * Consume an email_verify token and mark the user's email as verified.
 * @throws AppError TOKEN_INVALID if token is bad, expired, or used.
 */
export async function verifyEmail(rawToken: string): Promise<void> {
  const { userId } = await consumeToken(rawToken, 'email_verify');
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
}

/**
 * Consume a staff_invite token, set the user's password, and verify their email.
 * @throws AppError TOKEN_INVALID if token is bad, expired, or used.
 */
export async function setPasswordFromInvite(rawToken: string, password: string): Promise<void> {
  const { userId } = await consumeToken(rawToken, 'staff_invite');
  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash, emailVerified: true }).where(eq(users.id, userId));
}

/**
 * List all staff accounts in pending approval state for a given school.
 * @param schoolId - Scopes the query to the admin's school.
 */
export async function listPendingStaff(schoolId: string) {
  return db.select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).where(
    and(eq(users.approvalStatus, 'pending'), eq(users.schoolId, schoolId))
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/staff.service.test.ts
```

Expected: `8 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/staff.service.ts apps/api/src/__tests__/staff.service.test.ts
git commit -m "feat(api/auth): add staff service — register, approve, reject, invite, verify flows"
```

---

## Task 6: auth.service.ts — Login Guards (TDD)

**Files:**
- Modify: `apps/api/src/__tests__/auth.service.test.ts`
- Modify: `apps/api/src/services/auth.service.ts`

- [ ] **Step 1: Update seed data + add 3 new test cases to `auth.service.test.ts`**

**First**, open `apps/api/src/__tests__/auth.service.test.ts` and find the `beforeAll` where users are seeded. Update every staff/teacher user insert to include `emailVerified: true, approvalStatus: 'approved'` so existing login-success tests don't break under the new guards:

```typescript
// Example — your actual seed may differ, update accordingly:
await db.insert(users).values({
  email: 'staff@example.com',
  passwordHash: await bcrypt.hash('password123', 12),
  fullName: 'Staff User',
  role: 'teacher',
  schoolId: school.id,
  isActive: true,
  emailVerified: true,        // ← add this
  approvalStatus: 'approved', // ← add this
});
```

Students seeded with PIN login do not need these — the guards only fire for staff after credential check.

**Then**, add these 3 test cases inside the `login()` describe block, after the existing tests. They temporarily mutate the seeded user's state and restore it. Identify the seeded staff user's variable name (e.g. `staffUser`) and email from the existing test file:

```typescript
it('throws APPROVAL_PENDING when approvalStatus is pending', async () => {
  await db.update(users)
    .set({ approvalStatus: 'pending', isActive: false })
    .where(eq(users.id, staffUser.id));
  try {
    await expect(
      login({ identifier: 'staff@example.com', credential: 'password123' })
    ).rejects.toMatchObject({ code: 'APPROVAL_PENDING' });
  } finally {
    await db.update(users)
      .set({ approvalStatus: 'approved', isActive: true })
      .where(eq(users.id, staffUser.id));
  }
});

it('throws ACCOUNT_INACTIVE when approvalStatus is rejected', async () => {
  await db.update(users)
    .set({ approvalStatus: 'rejected', isActive: false })
    .where(eq(users.id, staffUser.id));
  try {
    await expect(
      login({ identifier: 'staff@example.com', credential: 'password123' })
    ).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
  } finally {
    await db.update(users)
      .set({ approvalStatus: 'approved', isActive: true })
      .where(eq(users.id, staffUser.id));
  }
});

it('throws EMAIL_NOT_VERIFIED when emailVerified is false', async () => {
  await db.update(users)
    .set({ emailVerified: false })
    .where(eq(users.id, staffUser.id));
  try {
    await expect(
      login({ identifier: 'staff@example.com', credential: 'password123' })
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  } finally {
    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, staffUser.id));
  }
});
```

- [ ] **Step 2: Run tests — confirm the 3 new cases fail**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/auth.service.test.ts
```

Expected: 3 new cases `FAIL` with unexpected error codes

- [ ] **Step 3: Add guards to `login()` in `apps/api/src/services/auth.service.ts`**

In the `login()` function, after the existing `if (!user.isActive)` check and after the credential validation block, add:

```typescript
  // After: if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'Account is inactive');
  if (user.approvalStatus === 'pending') throw new AppError('APPROVAL_PENDING', 'Account awaiting admin approval');
  if (user.approvalStatus === 'rejected') throw new AppError('ACCOUNT_INACTIVE', 'Account has been rejected');

  // ... existing credential check ...

  // After: if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');
  if (!user.emailVerified) throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in');
```

The full updated `login()` function body (replacing from the first `const isEmail` line through the `return` statement):

```typescript
export async function login(input: LoginInput) {
  const isEmail = input.identifier.includes('@');

  const [user] = await db
    .select()
    .from(users)
    .where(isEmail ? eq(users.email, input.identifier) : eq(users.studentId, input.identifier))
    .limit(1);

  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');
  if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'Account is inactive');
  if (user.approvalStatus === 'pending') throw new AppError('APPROVAL_PENDING', 'Account awaiting admin approval');
  if (user.approvalStatus === 'rejected') throw new AppError('ACCOUNT_INACTIVE', 'Account has been rejected');

  const hashToCheck = isEmail ? user.passwordHash : user.pinHash;
  if (!hashToCheck) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');

  const valid = await bcrypt.compare(input.credential, hashToCheck);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');

  if (!user.emailVerified) throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in');

  const accessToken = signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId });
  const rawRefreshToken = signRefreshToken();
  const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, fullName: user.fullName, role: user.role, schoolId: user.schoolId },
  };
}
```

- [ ] **Step 4: Run all auth tests — confirm all pass**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/auth.service.test.ts
```

Expected: all tests pass (including the 3 new guard cases)

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
pnpm --filter api test --reporter=verbose
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/auth.service.ts apps/api/src/__tests__/auth.service.test.ts
git commit -m "feat(api/auth): add approvalStatus and emailVerified guards to login()"
```

---

## Task 7: HTTP Layer — Staff Routes (TDD)

**Files:**
- Create: `apps/api/src/__tests__/staff.routes.test.ts`
- Create: `apps/api/src/controllers/staff.controller.ts`
- Create: `apps/api/src/routes/staff.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing HTTP tests — `apps/api/src/__tests__/staff.routes.test.ts`**

```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools, verificationTokens } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

vi.mock('../services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendStaffInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

let schoolId: string;
let adminToken: string;
let adminId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db.insert(schools).values({
    name: 'Routes Test School',
    address: '3 Routes Ave',
  }).returning({ id: schools.id });
  schoolId = school.id;

  const [admin] = await db.insert(users).values({
    email: `admin-routes-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Admin User',
    role: 'admin',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });

  adminId = admin.id;
  createdUserIds.push(adminId);
  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(verificationTokens).where(inArray(verificationTokens.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe('POST /api/v1/auth/register', () => {
  it('returns 201 on valid self-registration', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `self-register-${Date.now()}@school.com`,
        password: 'password123',
        fullName: 'Self Register',
        role: 'teacher',
        schoolId,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Clean up
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.fullName, 'Self Register')).limit(1);
    if (u) createdUserIds.push(u.id);
  });

  it('returns 409 on duplicate email', async () => {
    const email = `dup-routes-${Date.now()}@school.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'First', role: 'teacher', schoolId }),
    });
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (u) createdUserIds.push(u.id);

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'Second', role: 'librarian', schoolId }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 422 when role is student', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `student-role-${Date.now()}@school.com`,
        password: 'password123',
        fullName: 'Student Attempt',
        role: 'student',
        schoolId,
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 on missing required fields', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@school.com' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/admin/staff/pending', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/staff/pending');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const [teacher] = await db.insert(users).values({
      email: `teacher-noauth-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: 'Teacher NoAuth',
      role: 'teacher',
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(teacher.id);

    const teacherToken = signAccessToken({ sub: teacher.id, role: 'teacher', schoolId });
    const res = await app.request('/api/v1/admin/staff/pending', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with pending list for admin', async () => {
    const res = await app.request('/api/v1/admin/staff/pending', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('POST /api/v1/admin/staff/:id/approve', () => {
  it('returns 200 and approves pending staff', async () => {
    const email = `to-approve-${Date.now()}@school.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'To Approve', role: 'teacher', schoolId }),
    });
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);

    const res = await app.request(`/api/v1/admin/staff/${user.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const [updated] = await db.select({ approvalStatus: users.approvalStatus }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.approvalStatus).toBe('approved');
  });
});

describe('POST /api/v1/admin/staff/:id/reject', () => {
  it('returns 200 and rejects pending staff', async () => {
    const email = `to-reject-${Date.now()}@school.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'To Reject', role: 'teacher', schoolId }),
    });
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);

    const res = await app.request(`/api/v1/admin/staff/${user.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const [updated] = await db.select({ approvalStatus: users.approvalStatus }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.approvalStatus).toBe('rejected');
  });
});

describe('POST /api/v1/admin/staff', () => {
  it('returns 201 when admin creates staff', async () => {
    const email = `admin-created-${Date.now()}@school.com`;
    const res = await app.request('/api/v1/admin/staff', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, fullName: 'Admin Created', role: 'librarian', schoolId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    createdUserIds.push(body.data.id);
  });
});

describe('POST /api/v1/auth/verify-email', () => {
  it('returns 400 on invalid token', async () => {
    const res = await app.request('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64) }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/set-password', () => {
  it('returns 400 on invalid token', async () => {
    const res = await app.request('/api/v1/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'b'.repeat(64), password: 'newpassword123' }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/staff.routes.test.ts
```

Expected: `FAIL` — routes not mounted

- [ ] **Step 3: Create `apps/api/src/controllers/staff.controller.ts`**

```typescript
import type { Context } from 'hono';
import * as staffService from '../services/staff.service.js';
import { AppError } from '../services/auth.service.js';
import {
  RegisterStaffSchema,
  VerifyEmailSchema,
  SetPasswordSchema,
  CreateStaffByAdminSchema,
} from 'shared';

const APP_ERRORS_TO_HTTP: Record<string, number> = {
  EMAIL_ALREADY_EXISTS: 409,
  TOKEN_INVALID: 400,
  STAFF_NOT_FOUND: 404,
  EMAIL_SEND_FAILED: 502,
};

function errorResponse(c: Context, err: unknown) {
  if (err instanceof AppError) {
    const status = (APP_ERRORS_TO_HTTP[err.code] ?? 400) as 400 | 404 | 409 | 502;
    return c.json({ success: false, error: err.message, code: err.code }, status);
  }
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
}

/** POST /api/v1/auth/register */
export async function register(c: Context) {
  const body = await c.req.json();
  const parsed = RegisterStaffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await staffService.registerStaff(parsed.data);
    return c.json({ success: true, message: 'Registration submitted. Await admin approval.' }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
}

/** POST /api/v1/auth/verify-email */
export async function verifyEmailHandler(c: Context) {
  const body = await c.req.json();
  const parsed = VerifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await staffService.verifyEmail(parsed.data.token);
    return c.json({ success: true, message: 'Email verified. You can now log in.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/** POST /api/v1/auth/set-password */
export async function setPasswordHandler(c: Context) {
  const body = await c.req.json();
  const parsed = SetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await staffService.setPasswordFromInvite(parsed.data.token, parsed.data.password);
    return c.json({ success: true, message: 'Password set. You can now log in.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/** GET /api/v1/admin/staff/pending */
export async function listPending(c: Context) {
  const user = c.get('user');
  const data = await staffService.listPendingStaff(user.schoolId);
  return c.json({ success: true, data });
}

/** POST /api/v1/admin/staff/:id/approve */
export async function approve(c: Context) {
  const userId = c.req.param('id');
  try {
    await staffService.approveStaff(userId);
    return c.json({ success: true, message: 'Staff approved. Verification email sent.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/** POST /api/v1/admin/staff/:id/reject */
export async function reject(c: Context) {
  const userId = c.req.param('id');
  try {
    await staffService.rejectStaff(userId);
    return c.json({ success: true, message: 'Staff account rejected.' });
  } catch (err) {
    return errorResponse(c, err);
  }
}

/** POST /api/v1/admin/staff */
export async function createByAdmin(c: Context) {
  const body = await c.req.json();
  const parsed = CreateStaffByAdminSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    const result = await staffService.createStaffByAdmin(parsed.data);
    return c.json({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
}
```

- [ ] **Step 4: Create `apps/api/src/routes/staff.ts`**

```typescript
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import * as staffController from '../controllers/staff.controller.js';

export const staffAuthRouter = new Hono();
export const staffAdminRouter = new Hono();

staffAuthRouter.post('/register', staffController.register);
staffAuthRouter.post('/verify-email', staffController.verifyEmailHandler);
staffAuthRouter.post('/set-password', staffController.setPasswordHandler);

staffAdminRouter.use('*', requireAuth, requireRole('admin', 'librarian'));
staffAdminRouter.get('/pending', staffController.listPending);
staffAdminRouter.post('/:id/approve', staffController.approve);
staffAdminRouter.post('/:id/reject', staffController.reject);
staffAdminRouter.post('/', staffController.createByAdmin);
```

- [ ] **Step 5: Mount routes in `apps/api/src/index.ts`**

Add imports and route mounting:

```typescript
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { staffAuthRouter, staffAdminRouter } from './routes/staff.js';

export const app = new Hono();

app.use('*', logger());

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];

app.use('/api/*', cors({ origin: corsOrigins, credentials: true }));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/v1/auth', authRouter);
app.route('/api/v1/auth', staffAuthRouter);
app.route('/api/v1/admin/staff', staffAdminRouter);

app.notFound((c) => c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message, code: 'HTTP_ERROR' }, err.status);
  }
  console.error({ name: err.name, message: err.message, path: c.req.path });
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});
```

- [ ] **Step 6: Run staff route tests — confirm they pass**

```bash
pnpm --filter api test --reporter=verbose src/__tests__/staff.routes.test.ts
```

Expected: all tests pass

- [ ] **Step 7: Run full suite — confirm no regressions**

```bash
pnpm --filter api test --reporter=verbose
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/controllers/staff.controller.ts apps/api/src/routes/staff.ts apps/api/src/index.ts apps/api/src/__tests__/staff.routes.test.ts
git commit -m "feat(api/auth): add staff registration, approval, and invite HTTP routes"
```

---

## Task 8: Env Vars + Typecheck + Push

**Files:**
- Modify: `apps/api/vitest.config.ts`
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Add test env vars to `apps/api/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://librams:librams_dev@localhost:5432/librams',
      ACCESS_TOKEN_SECRET: 'test-access-secret-at-least-32-characters-long',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-32-characters-long',
      REDIS_URL: 'redis://localhost:6379',
      MEILISEARCH_HOST: 'http://localhost:7700',
      MEILISEARCH_API_KEY: 'masterKey',
      SENDGRID_API_KEY: 'SG.test-key-for-unit-tests',
      EMAIL_FROM: 'noreply@test.com',
      APP_URL: 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 2: Add vars to `.env` (root of librams/)**

Append to the existing `.env` file:

```
# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=noreply@yourdomain.com
APP_URL=http://localhost:3000
```

- [ ] **Step 3: Add vars to `.env.example`**

Append the same block to `.env.example`.

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter api typecheck
```

Expected: no errors

- [ ] **Step 5: Run full test suite one final time**

```bash
pnpm --filter api test --reporter=verbose
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/vitest.config.ts .env.example
git commit -m "chore: add SendGrid env vars to vitest config and env.example"
```

- [ ] **Step 7: Merge feature branch to master and push**

```bash
git checkout master
git merge feature/task-19-staff-registration --no-ff -m "feat: staff registration, approval, and email verification (Task 19)"
git push origin master
git push origin --delete feature/task-19-staff-registration
```

Expected: branch merged and pushed to GitHub
