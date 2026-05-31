import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../../stores/auth';
import { usePermission } from '../usePermission';

beforeEach(() => useAuthStore.getState().logout());

describe('usePermission', () => {
  it('returns false when not authenticated', () => {
    const { result } = renderHook(() => usePermission('catalog.view'));
    expect(result.current).toBe(false);
  });

  it('returns true for permission in effectivePermissions (role default)', () => {
    act(() =>
      useAuthStore.getState().setSession({
        accessToken: 'tok', refreshToken: 'ref',
        user: { id: 'u1', fullName: 'Lib', role: 'librarian', schoolId: 's1',
          effectivePermissions: ['catalog.view', 'catalog.create', 'students.view'] },
      })
    );
    const { result } = renderHook(() => usePermission('catalog.view'));
    expect(result.current).toBe(true);
  });

  it('returns true for a granted extra permission (library_assistant)', () => {
    act(() =>
      useAuthStore.getState().setSession({
        accessToken: 'tok', refreshToken: 'ref',
        user: { id: 'u2', fullName: 'Asst', role: 'library_assistant', schoolId: 's1',
          effectivePermissions: ['catalog.view'] },
      })
    );
    const { result } = renderHook(() => usePermission('catalog.view'));
    expect(result.current).toBe(true);
  });

  it('returns false for permission not in effectivePermissions', () => {
    act(() =>
      useAuthStore.getState().setSession({
        accessToken: 'tok', refreshToken: 'ref',
        user: { id: 'u2', fullName: 'Asst', role: 'library_assistant', schoolId: 's1',
          effectivePermissions: ['catalog.view'] },
      })
    );
    const { result } = renderHook(() => usePermission('students.reset_pin'));
    expect(result.current).toBe(false);
  });
});
