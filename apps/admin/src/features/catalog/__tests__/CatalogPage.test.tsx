import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogPage } from '../CatalogPage';

// ── Mock api ──────────────────────────────────────────────────────────────────
vi.mock('../../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import { api } from '../../../lib/api';

// ── Mock auth store ───────────────────────────────────────────────────────────
vi.mock('../../../stores/auth', () => ({
  useAuthStore: (sel: (s: { accessToken: string }) => unknown) =>
    sel({ accessToken: 'test-token' }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockBooks = [
  {
    id: 'book-1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    isbn: '9780743273565',
    genre: 'Fiction',
    readingLevel: 'Grade 10',
    description: 'A novel set in the Jazz Age.',
    callNumber: '813.52',
    coverUrl: null,
    availableCopies: 3,
    totalCopies: 5,
  },
  {
    id: 'book-2',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    isbn: '9780061935466',
    genre: 'Fiction',
    readingLevel: 'Grade 9',
    description: null,
    callNumber: '813.54',
    coverUrl: 'https://example.com/cover.jpg',
    availableCopies: 2,
    totalCopies: 4,
  },
];

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setup(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <CatalogPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CatalogPage', () => {
  it('renders book table with data from API', async () => {
    const qc = makeQc();
    vi.mocked(api.get).mockResolvedValue({ hits: mockBooks });

    setup(qc);

    await waitFor(() =>
      expect(screen.getByText('The Great Gatsby')).toBeInTheDocument()
    );
    expect(screen.getByText('To Kill a Mockingbird')).toBeInTheDocument();
    expect(screen.getByText('F. Scott Fitzgerald')).toBeInTheDocument();
    expect(screen.getByText('Harper Lee')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading', () => {
    const qc = makeQc();
    // Never resolves during this test — keeps loading state
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    setup(qc);

    // Skeleton divs have animate-pulse class
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('opens AddEditBookDialog on "Add Book" click', async () => {
    const qc = makeQc();
    vi.mocked(api.get).mockResolvedValue({ hits: [] });

    setup(qc);

    await userEvent.click(screen.getByRole('button', { name: /add book/i }));

    // Dialog title should now be visible
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    );
    // Dialog title is an h2 within the dialog
    expect(screen.getByRole('heading', { name: 'Add Book', level: 2 })).toBeInTheDocument();
  });

  it('calls DELETE endpoint and refreshes list on delete confirm', async () => {
    const qc = makeQc();
    vi.mocked(api.get).mockResolvedValue({ hits: mockBooks });
    vi.mocked(api.delete).mockResolvedValue(undefined);

    setup(qc);

    await waitFor(() => screen.getByText('The Great Gatsby'));

    // Click the first Delete button (The Great Gatsby row)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

    // Confirm dialog should appear
    await waitFor(() =>
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    );

    // Click the destructive confirm Delete button inside the dialog
    const confirmBtn = screen.getByRole('button', { name: /^delete$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/catalog/books/book-1')
    );
  });

  it('ISBN fetch fills form fields in AddEditBookDialog', async () => {
    const qc = makeQc();
    vi.mocked(api.get)
      // First call: search books
      .mockResolvedValueOnce({ hits: [] })
      // Second call: ISBN lookup
      .mockResolvedValueOnce({
        title: 'Fetched Title',
        author: 'Fetched Author',
        publisher: 'Fetched Publisher',
        year: 2020,
        description: 'Fetched description',
      });

    setup(qc);

    // Open Add Book dialog
    await userEvent.click(screen.getByRole('button', { name: /add book/i }));
    await waitFor(() => screen.getByRole('dialog'));

    // Type an ISBN
    const isbnInput = screen.getByPlaceholderText(/10 or 13 digits/i);
    await userEvent.type(isbnInput, '9780743273565');

    // Click Fetch from ISBN
    await userEvent.click(screen.getByRole('button', { name: /fetch from isbn/i }));

    // Fields should be populated from the mocked ISBN response
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Book title') as HTMLInputElement;
      expect(titleInput.value).toBe('Fetched Title');
    });
  });
});
