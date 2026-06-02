import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FinesPage } from '../FinesPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'test-token' }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FINE_RECORD = {
  checkoutId: 'aaaa-1111',
  userId: 'bbbb-2222',
  userName: 'Juan dela Cruz',
  bookTitle: 'Noli Me Tangere',
  dueDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  returnDate: null,
  fineAmount: 2.5,
  finePaid: false,
  fineWaived: false,
  daysOverdue: 5,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <FinesPage />
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FinesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fines table with data', async () => {
    mockGet.mockResolvedValue([FINE_RECORD]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan dela Cruz')).toBeInTheDocument();
    });

    expect(screen.getByText('Noli Me Tangere')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getAllByText('Outstanding').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /waive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark paid/i })).toBeInTheDocument();
  });

  it('waive button calls correct endpoint and refreshes', async () => {
    mockGet.mockResolvedValue([FINE_RECORD]);
    mockPost.mockResolvedValue({ checkoutId: 'aaaa-1111', fineAmount: 2.5, fineWaived: true });

    renderPage();

    await waitFor(() => screen.getByText('Juan dela Cruz'));

    fireEvent.click(screen.getByRole('button', { name: /waive/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/fines/aaaa-1111/waive', {});
    });

    // Refresh — mockGet called again
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('status filter changes API request param', async () => {
    mockGet.mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByText('No fines found.'));

    mockGet.mockResolvedValue([FINE_RECORD]);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/fines?status=all');
    });
  });
});
