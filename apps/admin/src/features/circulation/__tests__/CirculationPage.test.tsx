import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CirculationPage } from '../CirculationPage';

// Mock Quagga2 — jsdom has no camera APIs
vi.mock('@ericblade/quagga2', () => ({
  default: {
    init: vi.fn((_config: unknown, cb: (err: null) => void) => cb(null)),
    start: vi.fn(),
    stop: vi.fn(),
    onDetected: vi.fn(),
    offDetected: vi.fn(),
  },
}));

// Mock API client
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

// Capture onScan so tests can trigger scans
let capturedOnScan: ((barcode: string) => void) | null = null;

vi.mock('@/hooks/useBarcodeInput', () => ({
  useBarcodeInput: vi.fn(({ onScan }: { onScan: (b: string) => void }) => {
    capturedOnScan = onScan;
  }),
}));

import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function setup() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <CirculationPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  capturedOnScan = null;
  vi.clearAllMocks();
});

describe('CirculationPage', () => {
  it('renders heading and Checkout / Return tabs', () => {
    setup();
    expect(screen.getByRole('heading', { name: /circulation desk/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /checkout/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /return/i })).toBeInTheDocument();
  });

  it('calls the API with the correct barcode path on scan', async () => {
    vi.mocked(api.get).mockResolvedValue({
      copy: {
        id: 'c1',
        barcode: 'BARCODE123',
        copyNumber: 1,
        status: 'available',
        location: 'Shelf A',
      },
      book: {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '9780743273565',
        deweyDecimal: '813.52',
      },
    });

    setup();
    capturedOnScan?.('BARCODE123');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/copies/barcode/BARCODE123');
    });
  });

  it('displays book result card on successful scan', async () => {
    vi.mocked(api.get).mockResolvedValue({
      copy: {
        id: 'c1',
        barcode: 'BARCODE123',
        copyNumber: 2,
        status: 'available',
        location: 'Shelf B',
      },
      book: {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '9780061935466',
        deweyDecimal: '813.54',
      },
    });

    setup();
    capturedOnScan?.('BARCODE123');

    await waitFor(() => {
      expect(screen.getByText('To Kill a Mockingbird')).toBeInTheDocument();
    });
    expect(screen.getByText('Harper Lee')).toBeInTheDocument();
    expect(screen.getByText('9780061935466')).toBeInTheDocument();
    expect(screen.getByText('813.54')).toBeInTheDocument();
    expect(screen.getByText('available')).toBeInTheDocument();
  });

  it('shows error alert when API rejects (book not found)', async () => {
    vi.mocked(api.get).mockRejectedValue(
      new ApiError(404, 'COPY_NOT_FOUND', 'Not found')
    );

    setup();
    capturedOnScan?.('UNKNOWN999');

    await waitFor(() => {
      expect(
        screen.getByText(/no book found for barcode: UNKNOWN999/i)
      ).toBeInTheDocument();
    });
  });

  it('shows error alert when API throws a network error', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    setup();
    capturedOnScan?.('BAD001');

    await waitFor(() => {
      expect(
        screen.getByText(/no book found for barcode: BAD001/i)
      ).toBeInTheDocument();
    });
  });
});
