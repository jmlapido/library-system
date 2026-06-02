import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { InventoryPage } from '../InventoryPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
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

const AUDIT_RESULT = {
  scannedCount: 2,
  expectedCount: 3,
  found: [{ barcode: 'BC-001', title: 'Found Book', callNumber: '813.6' }],
  missing: [{ barcode: 'BC-002', title: 'Missing Book', callNumber: '813.7', lastSeen: '2026-01-01T00:00:00.000Z' }],
  unexpected: [{ barcode: 'BC-003', title: 'Wrong Status Book', status: 'checked_out' }],
};

const MISSING_ROWS = [
  {
    copyId: 'copy-uuid-1',
    barcode: 'BC-STALE-01',
    bookTitle: 'Lost Book',
    callNumber: '820.0',
    lastStatusChange: '2025-01-01T00:00:00.000Z',
    daysSinceActivity: 150,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <InventoryPage />
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue([]);
  });

  it('renders shelf audit tab by default', () => {
    renderPage();
    expect(screen.getByText('Shelf Audit')).toBeInTheDocument();
    expect(screen.getByText('Missing Books')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run audit/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/scan or paste barcodes/i)).toBeInTheDocument();
  });

  it('Run Audit button calls API and shows results', async () => {
    mockPost.mockResolvedValue(AUDIT_RESULT);
    renderPage();

    const textarea = screen.getByPlaceholderText(/scan or paste barcodes/i);
    fireEvent.change(textarea, { target: { value: 'BC-001\nBC-003' } });

    fireEvent.click(screen.getByRole('button', { name: /run audit/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/inventory/audit', {
        scannedBarcodes: ['BC-001', 'BC-003'],
      });
    });

    // Counts rendered in section badges
    expect(screen.getByText('1')).toBeInTheDocument(); // found
  });

  it('Missing Books tab renders table on mount', async () => {
    mockGet.mockResolvedValue(MISSING_ROWS);
    renderPage();

    fireEvent.click(screen.getByText('Missing Books'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/inventory/missing');
      expect(screen.getByText('Lost Book')).toBeInTheDocument();
      expect(screen.getByText('BC-STALE-01')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });
  });
});
