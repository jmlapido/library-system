import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAuthStore } from '../auth';

beforeEach(() => {
  useAuthStore.getState().logout();
});

const session = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  user: {
    id: 'u1',
    fullName: 'Jane Admin',
    role: 'admin' as const,
    schoolId: 's1',
    effectivePermissions: ['catalog.view', 'staff.approve'],
  },
};

describe('useAuthStore', () => {
  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('setSession stores tokens and user', () => {
    act(() => useAuthStore.getState().setSession(session));
    const state = useAuthStore.getState();
    expect(state.isAuthenticated()).toBe(true);
    expect(state.user?.role).toBe('admin');
    expect(state.user?.effectivePermissions).toContain('staff.approve');
  });

  it('setAccessToken updates only the token', () => {
    act(() => useAuthStore.getState().setSession(session));
    act(() => useAuthStore.getState().setAccessToken('new-token'));
    expect(useAuthStore.getState().accessToken).toBe('new-token');
    expect(useAuthStore.getState().user?.fullName).toBe('Jane Admin');
  });

  it('logout clears all state', () => {
    act(() => useAuthStore.getState().setSession(session));
    act(() => useAuthStore.getState().logout());
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
