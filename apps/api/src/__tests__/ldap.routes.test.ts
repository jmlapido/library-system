import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

const LDAP_SETTINGS = {
  ldapEnabled: true,
  ldapUrl: 'ldap://127.0.0.1:389',
  ldapBaseDn: 'DC=test,DC=local',
  ldapBindDn: 'CN=svc,DC=test,DC=local',
  ldapBindPassword: 'svcpass',
  ldapSearchFilter: '(mail={{email}})',
  ldapEmailAttribute: 'mail',
  ldapNameAttribute: 'displayName',
};

let schoolId: string;
let adminToken: string;
let librarianToken: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `LDAP School ${Date.now()}`, settings: LDAP_SETTINGS })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'admin' | 'librarian') => {
    const [u] = await db.insert(users).values({
      email: `ldap-${role}-${Date.now()}@test.com`,
      passwordHash: 'hash',
      fullName: `LDAP ${role}`,
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

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

function mockLdapModule(bindSucceeds: boolean) {
  vi.doMock('../services/ldap.service.js', () => ({
    verifyLdapCredentials: bindSucceeds
      ? vi.fn().mockResolvedValue({ email: 'test@test.local', fullName: 'Test User' })
      : vi.fn().mockRejectedValue(Object.assign(new Error('LDAP_AUTH_FAILED'), { code: 'LDAP_AUTH_FAILED' })),
    testLdapConnection: bindSucceeds
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(Object.assign(new Error('Connection refused'), { code: 'LDAP_UNAVAILABLE' })),
  }));
}

describe('POST /api/v1/auth/ldap/test-connection', () => {
  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/auth/ldap/test-connection', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for librarian (admin only)', async () => {
    const res = await app.request('/api/v1/auth/ldap/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when LDAP not configured', async () => {
    // School without LDAP
    const [bare] = await db.insert(schools).values({ name: `No LDAP ${Date.now()}` }).returning({ id: schools.id });
    const [u] = await db.insert(users).values({
      email: `noLdap-${Date.now()}@test.com`,
      passwordHash: 'h',
      fullName: 'NoLdap',
      role: 'admin',
      schoolId: bare!.id,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    const tok = signAccessToken({ sub: u!.id, role: 'admin', schoolId: bare!.id });

    const res = await app.request('/api/v1/auth/ldap/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('LDAP_NOT_CONFIGURED');

    await db.delete(users).where(eq(users.id, u!.id));
    await db.delete(schools).where(eq(schools.id, bare!.id));
  });

  it('returns 400 with LDAP_UNAVAILABLE when connection fails', async () => {
    // The real ldapjs will try to connect to 127.0.0.1:389 and fail quickly
    const res = await app.request('/api/v1/auth/ldap/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('LDAP_UNAVAILABLE');
  });
});

// ─── Unit tests for LDAP service logic ───────────────────────────────────────

describe('escapeFilter (via ldap.service unit)', () => {
  it('login with LDAP school when connection unavailable returns LDAP_UNAVAILABLE', async () => {
    const [u] = await db.select().from(users).where(eq(users.id, createdUserIds[0]!)).limit(1);
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: u!.email, credential: 'anypassword' }),
    });
    expect(res.status).toBe(503);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('LDAP_UNAVAILABLE');
  });
});
