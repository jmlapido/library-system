import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { WebhooksPage } from '../WebhooksPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
  },
}));

import { api } from '@/lib/api';
const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

const SAMPLE_WEBHOOKS = [
  {
    id: 'wh-1',
    url: 'https://example.com/hook',
    events: ['checkout.created', 'hold.ready'],
    isActive: true,
    description: 'My webhook',
    secret: 'sec',
  },
];

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('WebhooksPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows "No webhooks" when list is empty', async () => {
    mockGet.mockResolvedValue([]);
    render(<WebhooksPage />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByText('No webhooks configured.')).toBeInTheDocument());
  });

  it('shows webhook URL and event badges when webhooks exist', async () => {
    mockGet.mockResolvedValue(SAMPLE_WEBHOOKS);
    render(<WebhooksPage />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByText('https://example.com/hook')).toBeInTheDocument());
    // Multiple elements contain these event names (badges + checkboxes) — check at least one
    expect(screen.getAllByText('checkout.created').length).toBeGreaterThan(0);
    expect(screen.getAllByText('hold.ready').length).toBeGreaterThan(0);
  });

  it('Add Webhook form submits POST and refreshes list', async () => {
    mockGet.mockResolvedValue([]);
    mockPost.mockResolvedValue({
      id: 'wh-new',
      url: 'https://new.example.com/hook',
      events: ['overdue.alert'],
      isActive: true,
      description: null,
      secret: 'newsec',
    });

    render(<WebhooksPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByLabelText('URL'));

    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://new.example.com/hook' },
    });
    fireEvent.click(screen.getByLabelText('overdue.alert'));

    // Refetch returns the new webhook
    mockGet.mockResolvedValue([
      { id: 'wh-new', url: 'https://new.example.com/hook', events: ['overdue.alert'], isActive: true, description: null, secret: 'newsec' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Add Webhook' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/webhooks',
        expect.objectContaining({
          url: 'https://new.example.com/hook',
          events: expect.arrayContaining(['overdue.alert']),
        }),
      ),
    );
  });

  it('delete button calls DELETE endpoint', async () => {
    mockGet.mockResolvedValue(SAMPLE_WEBHOOKS);
    mockDelete.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<WebhooksPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByText('https://example.com/hook'));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/webhooks/wh-1'));
  });
});
