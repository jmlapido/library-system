import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CirculationPage } from '../CirculationPage';

vi.mock('@ericblade/quagga2', () => ({
  default: {
    init: vi.fn((_config: unknown, cb: (err: null) => void) => cb(null)),
    start: vi.fn(),
    stop: vi.fn(),
    onDetected: vi.fn(),
    offDetected: vi.fn(),
  },
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } };
});

let capturedOnScan: ((barcode: string) => void) | null = null;

vi.mock('@/hooks/useBarcodeInput', () => ({
  useBarcodeInput: vi.fn(({ onScan }: { onScan: (b: string) => void }) => {
    capturedOnScan = onScan;
  }),
}));

import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function setup() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <CirculationPage />
    </QueryClientProvider>
  );
}

const mockCopy = {
  copy: { id: 'c1', barcode: 'BOOK001', copyNumber: 1, status: 'checked_out', location: 'Shelf A' },
  book: { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061935466', deweyDecimal: '813.54' },
};

const mockStudent = { id: 'u1', fullName: 'Juan dela Cruz', studentId: 'STU001', gradeLevel: '10' };

beforeEach(() => {
  capturedOnScan = null;
  vi.clearAllMocks();
});

describe('CirculationPage', () => {
  it('renders heading and both tabs', () => {
    setup();
    expect(screen.getByRole('heading', { name: /circulation desk/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /checkout/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /return/i })).toBeInTheDocument();
  });
});

describe('ReturnTab', () => {
  async function switchToReturn() {
    setup();
    await userEvent.click(screen.getByRole('tab', { name: /return/i }));
  }

  it('shows barcode input on Return tab', async () => {
    await switchToReturn();
    expect(screen.getByLabelText(/book barcode/i)).toBeInTheDocument();
  });

  it('looks up book when barcode is scanned via USB', async () => {
    vi.mocked(api.get).mockResolvedValue(mockCopy);
    await switchToReturn();
    await act(async () => { capturedOnScan?.('BOOK001'); });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/copies/barcode/BOOK001');
    });
  });

  it('displays book card after successful lookup', async () => {
    vi.mocked(api.get).mockResolvedValue(mockCopy);
    await switchToReturn();
    await act(async () => { capturedOnScan?.('BOOK001'); });
    await waitFor(() => {
      expect(screen.getByText('To Kill a Mockingbird')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /confirm return/i })).toBeInTheDocument();
  });

  it('shows error when barcode not found', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, 'COPY_NOT_FOUND', 'Not found'));
    await switchToReturn();
    await act(async () => { capturedOnScan?.('UNKNOWN'); });
    await waitFor(() => {
      expect(screen.getByText(/no book found for barcode: UNKNOWN/i)).toBeInTheDocument();
    });
  });

  it('posts return and shows success message', async () => {
    vi.mocked(api.get).mockResolvedValue(mockCopy);
    vi.mocked(api.post).mockResolvedValue({ success: true });
    await switchToReturn();
    await act(async () => { capturedOnScan?.('BOOK001'); });
    await waitFor(() => screen.getByRole('button', { name: /confirm return/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm return/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/circulation/return', { barcode: 'BOOK001' });
      expect(screen.getByText(/return processed/i)).toBeInTheDocument();
    });
  });

  it('looks up book on manual barcode input + Enter key', async () => {
    vi.mocked(api.get).mockResolvedValue(mockCopy);
    await switchToReturn();
    const input = screen.getByLabelText(/book barcode/i);
    await userEvent.type(input, 'BOOK001');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/copies/barcode/BOOK001');
    });
  });
});

describe('CheckoutTab', () => {
  it('shows student input on Checkout tab by default', () => {
    setup();
    expect(screen.getByLabelText(/student id or name/i)).toBeInTheDocument();
  });

  it('USB scan in student step triggers student lookup', async () => {
    vi.mocked(api.get).mockResolvedValue([mockStudent]);
    setup();
    await act(async () => { capturedOnScan?.('STU001'); });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/students?search=STU001&limit=10');
    });
  });

  it('auto-selects student when exactly one result returned', async () => {
    vi.mocked(api.get).mockResolvedValue([mockStudent]);
    setup();
    await act(async () => { capturedOnScan?.('STU001'); });
    await waitFor(() => {
      expect(screen.getByText('Juan dela Cruz')).toBeInTheDocument();
      expect(screen.getByLabelText(/book barcode/i)).toBeInTheDocument();
    });
  });

  it('shows dropdown when multiple students match', async () => {
    vi.mocked(api.get).mockResolvedValue([
      mockStudent,
      { id: 'u2', fullName: 'Jose Rizal', studentId: 'STU002', gradeLevel: '11' },
    ]);
    setup();
    const input = screen.getByLabelText(/student id or name/i);
    await userEvent.type(input, 'Juan');
    await userEvent.click(screen.getByRole('button', { name: /find/i }));
    await waitFor(() => {
      expect(screen.getByText('Juan dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Jose Rizal')).toBeInTheDocument();
    });
  });

  it('full checkout flow: student → book → confirm → success', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce([mockStudent])
      .mockResolvedValueOnce(mockCopy);
    vi.mocked(api.post).mockResolvedValue({ id: 'chk1', dueDate: '2026-06-19T00:00:00.000Z' });

    setup();

    await act(async () => { capturedOnScan?.('STU001'); });
    await waitFor(() => screen.getByText('Juan dela Cruz'));

    await act(async () => { capturedOnScan?.('BOOK001'); });
    await waitFor(() => screen.getByText('To Kill a Mockingbird'));

    await userEvent.click(screen.getByRole('button', { name: /confirm checkout/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/circulation/checkout', {
        barcode: 'BOOK001',
        userId: 'u1',
      });
      expect(screen.getByText(/checkout successful/i)).toBeInTheDocument();
    });
  });
});
