import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

vi.mock('../services/embedding.service.js', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
  buildBookText: vi.fn().mockReturnValue(''),
  storeBookEmbedding: vi.fn().mockResolvedValue(undefined),
  findSimilarBooks: vi.fn().mockResolvedValue([]),
}));

let schoolId: string;
let userId: string;
let token: string;

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Embedding Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const [user] = await db
    .insert(users)
    .values({
      email: `embed-user-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: 'Embed User',
      role: 'student',
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    })
    .returning({ id: users.id });
  userId = user!.id;
  token = signAccessToken({ sub: userId, role: 'student', schoolId });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

describe('GET /api/v1/catalog/search/semantic', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/catalog/search/semantic?q=adventure');
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    const res = await app.request('/api/v1/catalog/search/semantic', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when q is empty string', async () => {
    const res = await app.request('/api/v1/catalog/search/semantic?q=   ', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with similarity results when findSimilarBooks returns data', async () => {
    const { findSimilarBooks } = await import('../services/embedding.service.js');
    vi.mocked(findSimilarBooks).mockResolvedValueOnce([{ bookId: 'test-uuid-1', similarity: 0.9 }]);

    const res = await app.request('/api/v1/catalog/search/semantic?q=adventure+books', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { bookId: string; similarity: number }[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.bookId).toBe('test-uuid-1');
    expect(body.data[0]!.similarity).toBe(0.9);
  });

  it('returns 200 with empty array when OPENAI_API_KEY absent (findSimilarBooks returns [])', async () => {
    const { findSimilarBooks } = await import('../services/embedding.service.js');
    vi.mocked(findSimilarBooks).mockResolvedValueOnce([]);

    const res = await app.request('/api/v1/catalog/search/semantic?q=science+fiction', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('respects the limit query parameter', async () => {
    const { findSimilarBooks } = await import('../services/embedding.service.js');
    vi.mocked(findSimilarBooks).mockResolvedValueOnce([]);

    const res = await app.request('/api/v1/catalog/search/semantic?q=mystery&limit=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(findSimilarBooks)).toHaveBeenCalledWith('mystery', schoolId, 5, undefined);
  });
});
