import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth';

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('stores tokens and user on login', () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: '1', name: 'Maria', role: 'student', studentId: '2024-001', gradeLevel: 'Grade 9' },
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('tok');
  });

  it('clears session on logout', () => {
    useAuthStore.getState().setSession({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: '1', name: 'Maria', role: 'student', studentId: '2024-001', gradeLevel: 'Grade 9' },
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
