import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools, oauthAccounts } from '../db/schema/index.js';

const SSO_SETTINGS = {
  ssoGoogleEnabled: true,
  ssoGoogleClientId: 'test-google-client-id',
  ssoGoogleClientSecret: 'test-google-client-secret',
  ssoMicrosoftEnabled: true,
  ssoMicrosoftClientId: 'test-ms-client-id',
  ssoMicrosoftClientSecret: 'test-ms-client-secret',
};

let schoolId: string;
let librarianId: string;
let studentId: string;
const LIBRARIAN_EMAIL = `oauth-lib-${Date.now()}@example.com`;
const STUDENT_EMAIL = `oauth-stu-${Date.now()}@example.com`;

function buildState(provider: string, sid: string, tsOffset = 0) {
  return Buffer.from(JSON.stringify({ provider, schoolId: sid, ts: Date.now() + tsOffset })).toString('base64url');
}

function mockFetch(googleSub: string, email: string, name: string) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('oauth2.googleapis.com/token') || String(url).includes('oauth2/v2.0/token')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: 'fake-at' }) });
    }
    if (String(url).includes('openidconnect.googleapis.com')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sub: googleSub, email, name }),
      });
    }
    if (String(url).includes('graph.microsoft.com')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: googleSub, mail: email, displayName: name }),
      });
    }
    return Promise.resolve({ ok: false, text: () => Promise.resolve('unexpected') });
  }));
}

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `OAuth School ${Date.now()}`, settings: SSO_SETTINGS })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const [lib] = await db.insert(users).values({
    email: LIBRARIAN_EMAIL,
    passwordHash: 'hash',
    fullName: 'OAuth Librarian',
    role: 'librarian',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  librarianId = lib!.id;

  const [stu] = await db.insert(users).values({
    email: STUDENT_EMAIL,
    passwordHash: 'hash',
    fullName: 'OAuth Student',
    role: 'student',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  studentId = stu!.id;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  // Clean up any oauth_accounts created during test
  await db.delete(oauthAccounts).where(eq(oauthAccounts.userId, librarianId));
  await db.delete(oauthAccounts).where(eq(oauthAccounts.userId, studentId));
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, librarianId));
  await db.delete(users).where(eq(users.id, studentId));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── Initiation ───────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/oauth/:provider', () => {
  it('returns 400 for unknown provider', async () => {
    const res = await app.request(`/api/v1/auth/oauth/slack?schoolId=${schoolId}`);
    expect(res.status).toBe(400);
  });

  it('redirects to Google auth URL when configured', async () => {
    const res = await app.request(`/api/v1/auth/oauth/google?schoolId=${schoolId}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('accounts.google.com');
    expect(res.headers.get('location')).toContain('test-google-client-id');
  });

  it('redirects to Microsoft auth URL when configured', async () => {
    const res = await app.request(`/api/v1/auth/oauth/microsoft?schoolId=${schoolId}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('login.microsoftonline.com');
    expect(res.headers.get('location')).toContain('test-ms-client-id');
  });

  it('returns 400 when SSO not configured for school', async () => {
    const [bare] = await db
      .insert(schools)
      .values({ name: `No SSO School ${Date.now()}` })
      .returning({ id: schools.id });
    const res = await app.request(`/api/v1/auth/oauth/google?schoolId=${bare!.id}`);
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('SSO_NOT_CONFIGURED');
    await db.delete(schools).where(eq(schools.id, bare!.id));
  });

  it('falls back to first school when schoolId omitted', async () => {
    // Should still get a redirect (first school has SSO config)
    const res = await app.request('/api/v1/auth/oauth/google');
    expect([302, 400]).toContain(res.status); // 302 if our school is first, 400 if a different school is first
  });
});

// ─── Callback ────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/oauth/:provider/callback', () => {
  it('redirects to frontend with error when provider query error', async () => {
    const res = await app.request('/api/v1/auth/oauth/google/callback?error=access_denied');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=access_denied');
    expect(res.headers.get('location')).toContain('oauth-callback');
  });

  it('redirects with MISSING_PARAMS when code absent', async () => {
    const state = buildState('google', schoolId);
    const res = await app.request(`/api/v1/auth/oauth/google/callback?state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('MISSING_PARAMS');
  });

  it('redirects with INVALID_OAUTH_STATE for bad state', async () => {
    const res = await app.request('/api/v1/auth/oauth/google/callback?code=abc&state=notbase64');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('INVALID_OAUTH_STATE');
  });

  it('redirects with OAUTH_STATE_EXPIRED for stale state', async () => {
    const stale = buildState('google', schoolId, -(11 * 60 * 1000));
    const res = await app.request(`/api/v1/auth/oauth/google/callback?code=abc&state=${stale}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('OAUTH_STATE_EXPIRED');
  });

  it('redirects with access_token fragment on successful Google login', async () => {
    mockFetch('google-sub-1', LIBRARIAN_EMAIL, 'OAuth Librarian');
    const state = buildState('google', schoolId);
    const res = await app.request(`/api/v1/auth/oauth/google/callback?code=valid-code&state=${state}`);
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('#');
    expect(loc).toContain('access_token=');
    expect(loc).toContain('refresh_token=');
  });

  it('links oauth_account on first login and reuses on second', async () => {
    mockFetch('google-sub-reuse', LIBRARIAN_EMAIL, 'OAuth Librarian');
    const state1 = buildState('google', schoolId);
    await app.request(`/api/v1/auth/oauth/google/callback?code=code1&state=${state1}`);

    // Second login — same sub, should reuse linked account
    const state2 = buildState('google', schoolId);
    const res2 = await app.request(`/api/v1/auth/oauth/google/callback?code=code2&state=${state2}`);
    expect(res2.status).toBe(302);
    expect(res2.headers.get('location')).toContain('access_token=');
  });

  it('redirects with USER_NOT_FOUND for unknown email', async () => {
    mockFetch('unknown-sub', 'unknown@nowhere.com', 'Unknown');
    const state = buildState('google', schoolId);
    const res = await app.request(`/api/v1/auth/oauth/google/callback?code=code&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('USER_NOT_FOUND');
  });

  it('redirects with FORBIDDEN for student email', async () => {
    mockFetch('stu-sub', STUDENT_EMAIL, 'OAuth Student');
    const state = buildState('google', schoolId);
    const res = await app.request(`/api/v1/auth/oauth/google/callback?code=code&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('FORBIDDEN');
  });

  it('works for Microsoft provider callback', async () => {
    mockFetch('ms-sub-1', LIBRARIAN_EMAIL, 'OAuth Librarian');
    const state = buildState('microsoft', schoolId);
    const res = await app.request(`/api/v1/auth/oauth/microsoft/callback?code=ms-code&state=${state}`);
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('access_token=');
  });
});
