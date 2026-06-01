import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReadingListsPage } from '../ReadingListsPage';

const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockPost = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    patch: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ReadingListsPage />
    </MemoryRouter>
  );
}

describe('ReadingListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No reading lists yet" when list is empty', async () => {
    mockGet.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No reading lists yet/i)).toBeInTheDocument();
    });
  });

  it('renders list cards when data exists', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 'list-1', title: 'Classics', description: 'Old books', isPublic: true, itemCount: 3, createdAt: new Date().toISOString() },
      { id: 'list-2', title: 'Sci-Fi Picks', description: null, isPublic: false, itemCount: 7, createdAt: new Date().toISOString() },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Classics')).toBeInTheDocument();
      expect(screen.getByText('Sci-Fi Picks')).toBeInTheDocument();
    });
  });

  it('shows public badge on public lists', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 'list-1', title: 'Public List', description: null, isPublic: true, itemCount: 1, createdAt: new Date().toISOString() },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Public')).toBeInTheDocument();
    });
  });

  it('shows new list form on button click', async () => {
    mockGet.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => screen.getByText('+ New List'));
    fireEvent.click(screen.getByText('+ New List'));
    expect(screen.getByPlaceholderText(/List title/i)).toBeInTheDocument();
  });

  it('hides form and shows Cancel label after opening', async () => {
    mockGet.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => screen.getByText('+ New List'));
    fireEvent.click(screen.getByText('+ New List'));
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls DELETE when delete confirmed', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 'list-1', title: 'To Delete', description: null, isPublic: false, itemCount: 0, createdAt: new Date().toISOString() },
    ]);
    mockDelete.mockResolvedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText('To Delete'));

    // Click Delete button to show confirmation
    const [firstDelete] = screen.getAllByText('Delete');
    fireEvent.click(firstDelete!);

    // Confirm deletion (second Delete button in confirmation panel)
    const confirmButtons = screen.getAllByText('Delete');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/reading-lists/list-1');
    });
  });

  it('shows item count on list cards', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 'list-1', title: 'My Reads', description: null, isPublic: false, itemCount: 5, createdAt: new Date().toISOString() },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/5 books/i)).toBeInTheDocument();
    });
  });
});
