import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShelvingQueuePage } from '../ShelvingQueuePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'test-token' }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const RETURNED_ITEM = {
  id: '11111111-1111-1111-1111-111111111111',
  barcode: 'LIB-00001',
  bookTitle: 'Harry Potter',
  coverUrl: null,
  returnedAt: new Date().toISOString(),
  stage: 'returned',
  lastActionBy: 'Alice',
};

const PROCESSING_ITEM = {
  id: '22222222-2222-2222-2222-222222222222',
  barcode: 'LIB-00002',
  bookTitle: 'The Hobbit',
  coverUrl: null,
  returnedAt: new Date().toISOString(),
  stage: 'being_processed',
  lastActionBy: 'Bob',
};

function mockFetchQueue(items = [RETURNED_ITEM, PROCESSING_ITEM]) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data: items }),
  } as Response);
}

function mockFetchQueueThenAdvance(
  items = [RETURNED_ITEM, PROCESSING_ITEM],
  newStage: string = 'being_processed',
) {
  global.fetch = vi
    .fn()
    // First call: GET shelving-queue
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: items }),
    } as Response)
    // Second call: POST advance
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { newStage } }),
    } as Response)
    // Third call: GET shelving-queue refresh
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: items }),
    } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShelvingQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders two columns with correct items in each', async () => {
    mockFetchQueue();

    render(<ShelvingQueuePage />);

    // Column headers
    expect(screen.getByText('Returned')).toBeInTheDocument();
    expect(screen.getByText('Being Processed')).toBeInTheDocument();

    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Harry Potter')).toBeInTheDocument();
      expect(screen.getByText('The Hobbit')).toBeInTheDocument();
    });

    // Barcodes visible
    expect(screen.getByText('LIB-00001')).toBeInTheDocument();
    expect(screen.getByText('LIB-00002')).toBeInTheDocument();
  });

  it('scan input is autofocused on mount', async () => {
    mockFetchQueue();

    render(<ShelvingQueuePage />);

    const input = screen.getByRole('textbox', { name: /barcode scan input/i });
    expect(document.activeElement).toBe(input);
  });

  it('pressing Enter in scan input calls advance API with barcode', async () => {
    mockFetchQueueThenAdvance();

    render(<ShelvingQueuePage />);

    // Wait for initial load
    await waitFor(() => screen.getByText('Harry Potter'));

    const input = screen.getByRole('textbox', { name: /barcode scan input/i });
    fireEvent.change(input, { target: { value: 'LIB-00001' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/circulation/return/advance'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ barcode: 'LIB-00001' }),
        }),
      );
    });
  });

  it('clicking Advance button on a card calls the correct API', async () => {
    mockFetchQueueThenAdvance();

    render(<ShelvingQueuePage />);

    await waitFor(() => screen.getByText('Harry Potter'));

    // Each card has an Advance button with aria-label containing the barcode
    const advanceBtn = screen.getByRole('button', { name: /advance lib-00001/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/circulation/return/advance'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ barcode: 'LIB-00001' }),
        }),
      );
    });
  });
});
