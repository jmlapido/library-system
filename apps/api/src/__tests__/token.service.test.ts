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
  }).returning({ id: schools.id });

  const [user] = await db.insert(users).values({
    email: `token-test-${Date.now()}@example.com`,
    passwordHash: 'hash',
    fullName: 'Token Test User',
    role: 'teacher',
    schoolId: school!.id,
  }).returning({ id: users.id });

  testUserId = user!.id;
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
