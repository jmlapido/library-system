import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateStaffDialog } from '../CreateStaffDialog';

vi.mock('../../../lib/api', () => ({
  api: { post: vi.fn() },
}));
import { api } from '../../../lib/api';

vi.mock('../../../stores/auth', () => ({
  useAuthStore: (sel: (s: { user: { schoolId: string } }) => unknown) =>
    sel({ user: { schoolId: 'school-1' } }),
}));

/**
 * Radix UI Select is not compatible with jsdom (lacks pointer capture APIs).
 * Replace with a native <select> that mirrors the onValueChange contract.
 */
vi.mock('../../../components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (val: string) => void;
  }) => (
    <select
      data-testid="role-select"
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

import React from 'react';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function setup(open = true, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <QueryClientProvider client={qc}>
        <CreateStaffDialog open={open} onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  qc.clear();
  vi.clearAllMocks();
});

describe('CreateStaffDialog', () => {
  it('renders dialog when open=true', () => {
    setup(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows validation errors for empty submit', async () => {
    setup(true);
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() =>
      expect(screen.getByText(/name required/i)).toBeInTheDocument(),
    );
  });

  it('calls POST /admin/staff on valid submit', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const { onClose } = setup(true);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Carol Cruz');
    await userEvent.type(screen.getByLabelText(/email/i), 'carol@school.edu');
    await userEvent.selectOptions(screen.getByTestId('role-select'), 'librarian');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/staff', {
        fullName: 'Carol Cruz',
        email: 'carol@school.edu',
        role: 'librarian',
        schoolId: 'school-1',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows error banner on mutation failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('server error'));
    setup(true);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Dana Diaz');
    await userEvent.type(screen.getByLabelText(/email/i), 'dana@school.edu');
    await userEvent.selectOptions(screen.getByTestId('role-select'), 'librarian');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to send invite/i)).toBeInTheDocument(),
    );
  });

  it('Cancel button triggers onClose', async () => {
    const { onClose } = setup(true);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
