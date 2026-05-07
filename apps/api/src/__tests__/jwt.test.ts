import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, signRefreshToken } from '../lib/jwt.js';

describe('JWT helpers', () => {
  const payload = { sub: 'user-uuid', role: 'student' as const, schoolId: 'school-uuid' };

  it('signAccessToken returns a non-empty string', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  it('verifyAccessToken decodes a valid token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.schoolId).toBe(payload.schoolId);
  });

  it('verifyAccessToken throws on invalid token', () => {
    expect(() => verifyAccessToken('bad.token.here')).toThrow();
  });

  it('signRefreshToken returns a 128-char hex string', () => {
    const token = signRefreshToken();
    expect(token).toMatch(/^[0-9a-f]{128}$/);
  });
});
