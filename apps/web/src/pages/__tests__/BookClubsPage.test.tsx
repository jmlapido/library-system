import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookClubsPage } from '../BookClubsPage';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (s: { user: { id: string; name: string; role: string; studentId: null; gradeLevel: null } | null }) => unknown) =>
    selector({ user: { id: 'user-1', name: 'Alice', role: 'student', studentId: null, gradeLevel: null } }),
}));

const makeClub = (overrides = {}) => ({
  id: 'club-1',
  name: 'Fantasy Readers',
  description: 'A club for fantasy fans',
  status: 'active' as const,
  memberCount: 5,
  maxMembers: 10,
  bookTitle: 'The Hobbit',
  bookId: 'book-1',
  startDate: null,
  endDate: null,
  organizerId: 'org-1',
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <BookClubsPage />
    </MemoryRouter>
  );
}

describe('BookClubsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders club cards when data exists', async () => {
    mockGet
      .mockResolvedValueOnce([makeClub(), makeClub({ id: 'club-2', name: 'Sci-Fi Circle' })])
      .mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Fantasy Readers')).toBeInTheDocument();
      expect(screen.getByText('Sci-Fi Circle')).toBeInTheDocument();
    });
  });

  it('shows empty state on My Clubs tab when no clubs', async () => {
    mockGet.mockResolvedValue([]);
    renderPage();
    await waitFor(() => screen.getByText('All Clubs'));

    fireEvent.click(screen.getByText('My Clubs'));
    await waitFor(() => {
      expect(screen.getByText(/haven't joined any clubs/i)).toBeInTheDocument();
    });
  });

  it('join button calls POST /:id/join', async () => {
    mockGet
      .mockResolvedValueOnce([makeClub()])
      .mockResolvedValueOnce([]);
    mockPost.mockResolvedValueOnce({});
    renderPage();

    await waitFor(() => screen.getByText('Fantasy Readers'));
    const joinBtn = screen.getByText('Join');
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/book-clubs/club-1/join', {});
    });
  });

  it('shows create form on button click', async () => {
    mockGet.mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByText('+ Create Club'));
    fireEvent.click(screen.getByText('+ Create Club'));

    expect(screen.getByPlaceholderText(/Club name/i)).toBeInTheDocument();
  });

  it('shows No clubs found when all-clubs list is empty', async () => {
    mockGet.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No clubs found.')).toBeInTheDocument();
    });
  });

  it('shows status badge on club cards', async () => {
    mockGet
      .mockResolvedValueOnce([makeClub({ status: 'planning' })])
      .mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Planning')).toBeInTheDocument();
    });
  });

  it('hides form and shows Cancel label after opening', async () => {
    mockGet.mockResolvedValue([]);
    renderPage();
    await waitFor(() => screen.getByText('+ Create Club'));
    fireEvent.click(screen.getByText('+ Create Club'));
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('leave button calls POST /:id/leave for member clubs', async () => {
    const club = makeClub({ id: 'club-3', name: 'Mystery Club' });
    mockGet
      .mockResolvedValueOnce([club])
      .mockResolvedValueOnce([{ ...club, organizerId: 'org-1' }]);
    mockPost.mockResolvedValueOnce({});
    renderPage();

    await waitFor(() => screen.getByText('My Clubs'));
    fireEvent.click(screen.getByText('My Clubs'));

    await waitFor(() => screen.getByText('Mystery Club'));
    const leaveBtn = screen.getByText('Leave');
    fireEvent.click(leaveBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/book-clubs/club-3/leave', {});
    });
  });
});
