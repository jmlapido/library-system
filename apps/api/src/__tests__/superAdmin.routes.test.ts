import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

// ─── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/superAdmin.service.js', () => ({
  listAllSchools: vi.fn(),
  getSchoolById: vi.fn(),
  createSchool: vi.fn(),
  updateSchool: vi.fn(),
}));

import {
  listAllSchools,
  getSchoolById,
  createSchool,
  updateSchool,
} from '../services/superAdmin.service.js';

const mockList = listAllSchools as ReturnType<typeof vi.fn>;
const mockGet = getSchoolById as ReturnType<typeof vi.fn>;
const mockCreate = createSchool as ReturnType<typeof vi.fn>;
const mockUpdate = updateSchool as ReturnType<typeof vi.fn>;

// ─── Fixtures ──────────────────────────────────────────────────────────────────

let schoolId: string;
let superAdminToken: string;
let adminToken: string;
const createdUserIds: string[] = [];

const SAMPLE_SCHOOL = {
  id: 'school-uuid-1',
  name: 'Test School',
  location: 'Manila',
  adminId: null,
  settings: {},
  createdAt: new Date(),
};

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `SuperAdmin Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'super_admin' | 'admin') => {
    const [u] = await db
      .insert(users)
      .values({
        email: `sa-${role}-${Date.now()}@test.com`,
        passwordHash: 'hash',
        fullName: `SA ${role}`,
        role,
        schoolId: role === 'super_admin' ? null : schoolId,
        isActive: true,
        emailVerified: true,
        approvalStatus: 'approved',
      })
      .returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  const [saId, adminId] = await Promise.all([mkUser('super_admin'), mkUser('admin')]);
  superAdminToken = signAccessToken({ sub: saId, role: 'super_admin', schoolId: null });
  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
});

afterAll(async () => {
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

beforeEach(() => vi.clearAllMocks());

// ─── GET /schools ──────────────────────────────────────────────────────────────

describe('GET /api/v1/super-admin/schools', () => {
  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/super-admin/schools');
    expect(res.status).toBe(401);
  });

  it('returns 403 for admin role (not super_admin)', async () => {
    mockList.mockResolvedValue([]);
    const res = await app.request('/api/v1/super-admin/schools', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with array for super_admin', async () => {
    mockList.mockResolvedValue([SAMPLE_SCHOOL]);
    const res = await app.request('/api/v1/super-admin/schools', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 200 with empty array when no schools', async () => {
    mockList.mockResolvedValue([]);
    const res = await app.request('/api/v1/super-admin/schools', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.data).toEqual([]);
  });
});

// ─── POST /schools ─────────────────────────────────────────────────────────────

describe('POST /api/v1/super-admin/schools', () => {
  it('returns 400 when name is missing', async () => {
    const res = await app.request('/api/v1/super-admin/schools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: 'Manila' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is empty string', async () => {
    const res = await app.request('/api/v1/super-admin/schools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 on valid input', async () => {
    mockCreate.mockResolvedValue(SAMPLE_SCHOOL);
    const res = await app.request('/api/v1/super-admin/schools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test School', location: 'Manila' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { name: string }; message: string };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test School');
    expect(body.message).toBe('School created');
  });
});

// ─── GET /schools/:id ─────────────────────────────────────────────────────────

describe('GET /api/v1/super-admin/schools/:id', () => {
  it('returns 404 when school not found', async () => {
    const { AppError } = await import('../utils/errors.js');
    mockGet.mockRejectedValue(new AppError('SCHOOL_NOT_FOUND', 'School not found'));
    const res = await app.request('/api/v1/super-admin/schools/nonexistent-id', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('SCHOOL_NOT_FOUND');
  });

  it('returns 200 when school exists', async () => {
    mockGet.mockResolvedValue(SAMPLE_SCHOOL);
    const res = await app.request('/api/v1/super-admin/schools/school-uuid-1', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { name: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test School');
  });
});

// ─── PATCH /schools/:id ───────────────────────────────────────────────────────

describe('PATCH /api/v1/super-admin/schools/:id', () => {
  it('returns 404 when school not found', async () => {
    const { AppError } = await import('../utils/errors.js');
    mockUpdate.mockRejectedValue(new AppError('SCHOOL_NOT_FOUND', 'School not found'));
    const res = await app.request('/api/v1/super-admin/schools/nonexistent-id', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('SCHOOL_NOT_FOUND');
  });

  it('returns 200 on successful update', async () => {
    mockUpdate.mockResolvedValue({ ...SAMPLE_SCHOOL, name: 'Updated School' });
    const res = await app.request('/api/v1/super-admin/schools/school-uuid-1', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated School' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { name: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated School');
  });
});
