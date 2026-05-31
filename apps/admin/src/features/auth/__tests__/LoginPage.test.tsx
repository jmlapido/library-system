import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../LoginPage';
import { useAuthStore } from '../../../stores/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../lib/api', () => ({
  api: { post: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
}));

import { api, ApiError } from '../../../lib/api';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function setup() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  useAuthStore.getState().logout();
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('shows APPROVAL_PENDING error message', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, 'APPROVAL_PENDING', ''));
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@school.edu');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/awaiting admin approval/i)).toBeInTheDocument()
    );
  });

  it('shows ACCOUNT_INACTIVE error message', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, 'ACCOUNT_INACTIVE', ''));
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@school.edu');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/has been deactivated/i)).toBeInTheDocument()
    );
  });

  it('shows EMAIL_NOT_VERIFIED error message', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, 'EMAIL_NOT_VERIFIED', ''));
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@school.edu');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/verify your account/i)).toBeInTheDocument()
    );
  });
});
