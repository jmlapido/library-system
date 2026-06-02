import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

// ─── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/webhooks.service.js', () => ({
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  toggleWebhook: vi.fn(),
  generateWebhookSecret: vi.fn().mockReturnValue('mocksecret'),
  signPayload: vi.fn().mockReturnValue('sha256=mocksig'),
  dispatchWebhookEvent: vi.fn(),
}));

// Prevent real BullMQ connections
vi.mock('../lib/queue.js', () => ({
  webhookQueue: { add: vi.fn() },
}));

import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
} from '../services/webhooks.service.js';

const mockList = listWebhooks as ReturnType<typeof vi.fn>;
const mockCreate = createWebhook as ReturnType<typeof vi.fn>;
const mockDelete = deleteWebhook as ReturnType<typeof vi.fn>;
const mockToggle = toggleWebhook as ReturnType<typeof vi.fn>;

// ─── Test fixtures ─────────────────────────────────────────────────────────────

let schoolId: string;
let adminToken: string;
let librarianToken: string;
const createdUserIds: string[] = [];

const SAMPLE_WEBHOOK = {
  id: 'wh-1',
  schoolId: 'school-1',
  url: 'https://example.com/hook',
  secret: 'secret',
  events: ['checkout.created'],
  isActive: true,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Webhooks School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'admin' | 'librarian') => {
    const [u] = await db.insert(users).values({
      email: `wh-${role}-${Date.now()}@test.com`,
      passwordHash: 'hash',
      fullName: `WH ${role}`,
      role,
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  const [adminId, libId] = await Promise.all([mkUser('admin'), mkUser('librarian')]);
  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
  librarianToken = signAccessToken({ sub: libId, role: 'librarian', schoolId });
});

afterAll(async () => {
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

beforeEach(() => vi.clearAllMocks());

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/webhooks', () => {
  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/webhooks');
    expect(res.status).toBe(401);
  });

  it('returns 403 for librarian role', async () => {
    mockList.mockResolvedValue([]);
    const res = await app.request('/api/v1/webhooks', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty array when no webhooks', async () => {
    mockList.mockResolvedValue([]);
    const res = await app.request('/api/v1/webhooks', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

describe('POST /api/v1/webhooks', () => {
  it('returns 400 when url is missing', async () => {
    const res = await app.request('/api/v1/webhooks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['checkout.created'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when events is empty', async () => {
    const res = await app.request('/api/v1/webhooks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 on valid input', async () => {
    mockCreate.mockResolvedValue(SAMPLE_WEBHOOK);
    const res = await app.request('/api/v1/webhooks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: ['checkout.created'] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: typeof SAMPLE_WEBHOOK };
    expect(body.success).toBe(true);
    expect(body.data.url).toBe('https://example.com/hook');
  });
});

describe('DELETE /api/v1/webhooks/:id', () => {
  it('returns 404 when webhook not found', async () => {
    const { AppError } = await import('../utils/errors.js');
    mockDelete.mockRejectedValue(new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found'));
    const res = await app.request('/api/v1/webhooks/nonexistent-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('WEBHOOK_NOT_FOUND');
  });

  it('returns 200 on successful delete', async () => {
    mockDelete.mockResolvedValue(undefined);
    const res = await app.request('/api/v1/webhooks/some-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

describe('PATCH /api/v1/webhooks/:id/toggle', () => {
  it('returns 400 when isActive is missing', async () => {
    const res = await app.request('/api/v1/webhooks/some-id/toggle', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 on successful toggle', async () => {
    mockToggle.mockResolvedValue({ ...SAMPLE_WEBHOOK, isActive: false });
    const res = await app.request('/api/v1/webhooks/some-id/toggle', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { isActive: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);
  });
});
