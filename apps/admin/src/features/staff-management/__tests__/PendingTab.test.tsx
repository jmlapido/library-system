import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PendingTab } from '../PendingTab';

vi.mock('../../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
import { api } from '../../../lib/api';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const pendingStaff = [
  { id: 'u1', fullName: 'Alice Reyes', email: 'alice@school.edu', role: 'librarian', createdAt: '2026-05-01T08:00:00Z' },
  { id: 'u2', fullName: 'Bob Santos', email: 'bob@school.edu', role: 'library_assistant', createdAt: '2026-05-02T09:00:00Z' },
];

function setup() {
  vi.mocked(api.get).mockResolvedValue(pendingStaff);
  return render(<QueryClientProvider client={qc}><PendingTab /></QueryClientProvider>);
}

beforeEach(() => { qc.clear(); vi.clearAllMocks(); });

describe('PendingTab', () => {
  it('renders pending staff rows', async () => {
    setup();
    await waitFor(() => expect(screen.getByText('Alice Reyes')).toBeInTheDocument());
    expect(screen.getByText('Bob Santos')).toBeInTheDocument();
  });

  it('approve button calls POST /admin/staff/:id/approve', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    setup();
    await waitFor(() => screen.getByText('Alice Reyes'));
    const aliceRow = screen.getByText('Alice Reyes').closest('tr')!;
    await userEvent.click(within(aliceRow).getByRole('button', { name: /approve/i }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/staff/u1/approve', {})
    );
  });

  it('reject button opens the reject dialog', async () => {
    setup();
    await waitFor(() => screen.getByText('Alice Reyes'));
    const aliceRow = screen.getByText('Alice Reyes').closest('tr')!;
    await userEvent.click(within(aliceRow).getByRole('button', { name: /reject/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows empty state when no pending registrations', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    render(<QueryClientProvider client={qc}><PendingTab /></QueryClientProvider>);
    await waitFor(() =>
      expect(screen.getByText(/no pending registrations/i)).toBeInTheDocument()
    );
  });
});
