import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuditLogPage } from '../AuditLogPage';
import { ApiError } from '../../../lib/api';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockEntry = {
  id: 'entry-1',
  actorName: 'Maria Santos',
  actorRole: 'admin',
  action: 'book.created',
  recordId: 'b-uuid-0001',
  recordDescription: 'The Alchemist by Paulo Coelho',
  ipAddress: '192.168.1.1',
  createdAt: '2026-06-01T08:00:00Z',
};

const mockResponse = {
  entries: [mockEntry],
  total: 1,
  page: 1,
  totalPages: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AuditLogPage />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit log entries in the table after data loads', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.get).mockResolvedValue(mockResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('book.created')).toBeInTheDocument();
    expect(screen.getByText('The Alchemist by Paulo Coelho')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('shows skeleton rows while data is loading', async () => {
    const { api } = await import('../../../lib/api');
    // Never resolves — keeps page in loading state
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    renderPage();

    // Skeleton elements are rendered during loading
    const skeletons = document.querySelectorAll('[class*="skeleton"], .animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    // Actor name must NOT be present yet
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  it('calls API with action param when filter dropdown changes', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.get).mockResolvedValue(mockResponse);

    renderPage();

    await waitFor(() => expect(screen.getByText('Audit Log')).toBeInTheDocument());

    const trigger = screen.getByTestId('action-select');
    await userEvent.click(trigger);

    const option = await screen.findByText('book.created');
    await userEvent.click(option);

    await waitFor(() => {
      const calls = vi.mocked(api.get).mock.calls;
      const lastEntry = calls[calls.length - 1];
      expect(lastEntry).toBeDefined();
      const lastCall = lastEntry![0] as string;
      expect(lastCall).toContain('action=book.created');
    });
  });

  it('handles 404 gracefully — shows "coming soon" message without crashing', async () => {
    const { api, ApiError: ActualApiError } = await import('../../../lib/api');
    vi.mocked(api.get).mockRejectedValue(
      new ActualApiError(404, 'NOT_FOUND', 'Endpoint not found')
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/audit log coming soon/i)).toBeInTheDocument();
    });

    // Page must not crash — heading still present
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('shows empty state when entries array is empty', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.get).mockResolvedValue({ entries: [], total: 0, page: 1, totalPages: 0 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No audit log entries found.')).toBeInTheDocument();
    });
  });

  it('shows generic error message for non-404 failures', async () => {
    const { api, ApiError: ActualApiError } = await import('../../../lib/api');
    vi.mocked(api.get).mockRejectedValue(
      new ActualApiError(500, 'SERVER_ERROR', 'Internal server error')
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load audit log/i)).toBeInTheDocument();
    });
  });
});
