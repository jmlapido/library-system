import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { useAuthStore } from '../../../stores/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api')>('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

import { api } from '../../../lib/api';
import { ApiError } from '../../../lib/api';

function setup() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.getState().logout();
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it.each([
    ['APPROVAL_PENDING', /awaiting admin approval/i],
    ['ACCOUNT_INACTIVE', /has been deactivated/i],
    ['EMAIL_NOT_VERIFIED', /verify your account/i],
    ['INVALID_CREDENTIALS', /invalid email or password/i],
  ] as const)('shows %s error message', async (code, pattern) => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, code, ''));
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@school.edu');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(pattern)).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      identifier: 'jane@school.edu',
      credential: 'pass1234',
    });
  });

  it('calls setSession and navigates to /staff-management on admin login', async () => {
    const mockResult = {
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: 'u1', fullName: 'Jane', role: 'admin' as const, schoolId: 's1', effectivePermissions: [] },
    };
    vi.mocked(api.post).mockResolvedValue(mockResult);
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@school.edu');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/staff-management', { replace: true }));
  });
});
