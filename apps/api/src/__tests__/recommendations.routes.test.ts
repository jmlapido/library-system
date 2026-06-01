import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

// Mock Redis to prevent actual Redis calls and allow cache-hit simulation
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

let schoolId: string;
let studentId: string;
let studentToken: string;

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Recs Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const [student] = await db
    .insert(users)
    .values({
      email: `recs-student-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: 'Recs Student',
      role: 'student',
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    })
    .returning({ id: users.id });
  studentId = student!.id;
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, studentId));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/recommendations', () => {
  it('returns 401 without an auth token', async () => {
    const res = await app.request('/api/v1/recommendations');
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty array when ANTHROPIC_API_KEY is not set', async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await app.request('/api/v1/recommendations', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; message: string };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.message).toBe('AI recommendations not configured');

    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('returns 200 with cached data when Redis cache hits', async () => {
    const { redis } = await import('../lib/redis.js');

    const cachedPayload = [
      {
        book: {
          id: 'cached-book-id',
          title: 'The Great Gatsby',
          author: 'F. Scott Fitzgerald',
          genre: 'Fiction',
          description: 'A novel set in the 1920s.',
          readingLevel: 'Grade 10',
          isbn: null,
          publisher: null,
          publicationYear: 1925,
          coverUrl: null,
          category: null,
          subjectTags: null,
          language: 'en',
          pageCount: 180,
          lexileLevel: null,
          seriesName: null,
          seriesNumber: null,
          deweyDecimal: null,
          schoolId,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        reasoning: 'Matches the student reading level and genre interest.',
      },
    ];

    vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(cachedPayload));

    const savedKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const res = await app.request('/api/v1/recommendations', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; message: string };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.message).toBe('Recommendations retrieved successfully');

    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    else delete process.env.ANTHROPIC_API_KEY;
  });
});
