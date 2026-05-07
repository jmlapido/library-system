import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { signAccessToken, type AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

function makeApp() {
  const app = new Hono<{ Variables: Variables }>();
  app.use('/protected', requireAuth);
  app.get('/protected', (c) => {
    const user = c.get('user');
    return c.json({ userId: user.sub, role: user.role });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('rejects request with no Authorization header', async () => {
    const res = await makeApp().request('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects request with malformed token', async () => {
    const res = await makeApp().request('/protected', {
      headers: { Authorization: 'Bearer bad.token' },
    });
    expect(res.status).toBe(401);
  });

  it('allows request with valid token and attaches user to context', async () => {
    const token = signAccessToken({ sub: 'user-1', role: 'student', schoolId: 'school-1' });
    const res = await makeApp().request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { userId: string; role: string };
    expect(body.userId).toBe('user-1');
    expect(body.role).toBe('student');
  });
});
