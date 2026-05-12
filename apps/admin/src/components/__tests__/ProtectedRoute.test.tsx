import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { ProtectedRoute } from '../ProtectedRoute';

beforeEach(() => useAuthStore.getState().logout());

const adminSession = {
  accessToken: 'tok',
  refreshToken: 'ref',
  user: { id: 'u1', fullName: 'Jane', role: 'admin' as const, schoolId: 's1', effectivePermissions: [] },
};

function setup(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Root</div>} />
        <Route
          path="/staff-management"
          element={
            <ProtectedRoute roles={['admin', 'librarian']}>
              <div>Staff Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute roles={['admin']}>
              <div>Audit Log</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    setup('/staff-management');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects wrong-role users to /', () => {
    act(() =>
      useAuthStore.getState().setSession({
        ...adminSession,
        user: { ...adminSession.user, role: 'library_assistant' },
      })
    );
    setup('/audit-log');
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('renders content for correct role', () => {
    act(() => useAuthStore.getState().setSession(adminSession));
    setup('/staff-management');
    expect(screen.getByText('Staff Page')).toBeInTheDocument();
  });
});
