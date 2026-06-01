import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AchievementsPage } from '../AchievementsPage';

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
  useAuthStore: (
    selector: (s: {
      user: { id: string; name: string; role: string; studentId: null; gradeLevel: null } | null;
    }) => unknown
  ) => selector({ user: { id: 'user-1', name: 'Alice', role: 'student', studentId: null, gradeLevel: null } }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeBadge = (overrides: Partial<{
  id: string; schoolId: string; name: string; description: string;
  iconUrl: string | null; criteria: string; createdAt: string;
}> = {}) => ({
  id: 'badge-1',
  schoolId: 'school-1',
  name: 'Bookworm',
  description: 'Read your first book',
  iconUrl: null,
  criteria: 'books_read_1',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeUserBadge = (badge = makeBadge()) => ({
  id: 'ub-1',
  userId: 'user-1',
  badgeId: badge.id,
  earnedAt: new Date().toISOString(),
  badge,
});

const makeChallenge = (overrides: Partial<{
  id: string; schoolId: string; title: string; description: string;
  goal: number; goalType: string; startDate: string; endDate: string;
  status: string; createdAt: string;
}> = {}) => ({
  id: 'ch-1',
  schoolId: 'school-1',
  title: 'Summer Reading',
  description: 'Read 10 books this summer',
  goal: 10,
  goalType: 'books_read',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
  status: 'active',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeEnrollment = (challenge = makeChallenge(), overrides = {}) => ({
  id: 'enr-1',
  challengeId: challenge.id,
  userId: 'user-1',
  progress: 3,
  completed: false,
  completedAt: null,
  challenge,
  ...overrides,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Default mock: badges tab = empty, challenges tab = empty (set manually per test). */
function setupBadgesTab(allBadges: ReturnType<typeof makeBadge>[], userBadges: ReturnType<typeof makeUserBadge>[]) {
  mockGet
    .mockResolvedValueOnce(allBadges)   // GET /badges
    .mockResolvedValueOnce(userBadges); // GET /badges/me
}

function setupChallengesTab(
  challenges: ReturnType<typeof makeChallenge>[],
  enrollments: ReturnType<typeof makeEnrollment>[]
) {
  mockGet
    .mockResolvedValueOnce(challenges)   // GET /challenges
    .mockResolvedValueOnce(enrollments); // GET /challenges/me
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AchievementsPage />
    </MemoryRouter>
  );
}

/** Switches to the Challenges tab. */
async function switchToChallenges() {
  const btn = await screen.findByRole('button', { name: /challenges/i });
  fireEvent.click(btn);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AchievementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Badges tab ─────────────────────────────────────────────────────────────

  it('shows empty state when no badges defined for school', async () => {
    setupBadgesTab([], []);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No badges defined/i)).toBeInTheDocument();
    });
  });

  it('renders earned badge in "My Badges" section', async () => {
    const badge = makeBadge({ name: 'Bookworm' });
    const ub = makeUserBadge(badge);
    setupBadgesTab([badge], [ub]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Bookworm')).toBeInTheDocument();
      expect(screen.getByText(/My Badges \(1\)/i)).toBeInTheDocument();
    });
  });

  it('renders unearned badge in "Locked" section with grayscale style', async () => {
    const earned = makeBadge({ id: 'badge-1', name: 'Bookworm', criteria: 'books_read_1' });
    const locked = makeBadge({ id: 'badge-2', name: 'Scholar', criteria: 'books_read_5' });
    const ub = makeUserBadge(earned);
    setupBadgesTab([earned, locked], [ub]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Scholar')).toBeInTheDocument();
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    // Locked badge card should have grayscale filter applied
    const scholarEl = screen.getByText('Scholar').closest('div[style]');
    expect(scholarEl).toBeTruthy();
    expect(scholarEl!.getAttribute('style')).toContain('grayscale(100%)');
  });

  it('earned badge card does NOT have grayscale filter', async () => {
    const badge = makeBadge({ name: 'Bookworm' });
    setupBadgesTab([badge], [makeUserBadge(badge)]);
    renderPage();
    await waitFor(() => screen.getByText('Bookworm'));

    const bookwormEl = screen.getByText('Bookworm').closest('div[style]');
    expect(bookwormEl!.getAttribute('style')).not.toContain('grayscale(100%)');
  });

  it('shows "Earned" date label on earned badges', async () => {
    const badge = makeBadge({ name: 'Bookworm' });
    setupBadgesTab([badge], [makeUserBadge(badge)]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Earned/i)).toBeInTheDocument();
    });
  });

  it('shows criteria hint on locked badges', async () => {
    const badge = makeBadge({ id: 'badge-2', name: 'Scholar', criteria: 'books_read_5' });
    setupBadgesTab([badge], []);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Read 5 books')).toBeInTheDocument();
    });
  });

  it('shows badge grid with badge cards', async () => {
    const b1 = makeBadge({ id: 'b-1', name: 'First Read', criteria: 'books_read_1' });
    const b2 = makeBadge({ id: 'b-2', name: 'Five Books', criteria: 'books_read_5' });
    setupBadgesTab([b1, b2], [makeUserBadge(b1)]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('First Read')).toBeInTheDocument();
      expect(screen.getByText('Five Books')).toBeInTheDocument();
    });
  });

  // ── Challenges tab ─────────────────────────────────────────────────────────

  it('renders challenges tab with filter chips', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    setupChallengesTab([], []);
    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Active$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Upcoming$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Completed$/i })).toBeInTheDocument();
    });
  });

  it('renders challenge cards with title and goal', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    const challenge = makeChallenge({ title: 'Summer Reading', goal: 10 });
    setupChallengesTab([challenge], []);
    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));

    await waitFor(() => {
      expect(screen.getByText('Summer Reading')).toBeInTheDocument();
      expect(screen.getByText(/Goal: 10 books/i)).toBeInTheDocument();
    });
  });

  it('shows progress bar on enrolled challenge', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    const challenge = makeChallenge({ title: 'Read-a-Thon', goal: 10 });
    const enrollment = makeEnrollment(challenge, { progress: 4 });
    setupChallengesTab([challenge], [enrollment]);
    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));

    await waitFor(() => {
      expect(screen.getByText(/4\/10 books/i)).toBeInTheDocument();
    });
  });

  it('enroll button calls POST /challenges/:id/enroll', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    const challenge = makeChallenge({ id: 'ch-99', title: 'Book Sprint', status: 'active' });
    setupChallengesTab([challenge], []);
    mockPost.mockResolvedValueOnce({ success: true });

    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));

    await waitFor(() => screen.getByText('Book Sprint'));
    fireEvent.click(screen.getByText('Enroll'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/challenges/ch-99/enroll', {});
    });
  });

  it('hides enroll button after enrollment', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    const challenge = makeChallenge({ id: 'ch-99', title: 'Book Sprint', status: 'active' });
    setupChallengesTab([challenge], []);
    mockPost.mockResolvedValueOnce({ success: true });

    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));
    await waitFor(() => screen.getByText('Enroll'));
    fireEvent.click(screen.getByText('Enroll'));

    await waitFor(() => {
      expect(screen.queryByText('Enroll')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no active challenges match filter', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    const challenge = makeChallenge({ status: 'upcoming' });
    setupChallengesTab([challenge], []);
    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));

    await waitFor(() => screen.getByRole('button', { name: /^Active$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Active$/i }));

    await waitFor(() => {
      expect(screen.getByText(/No active challenges/i)).toBeInTheDocument();
    });
  });

  it('shows completed label on completed enrollment', async () => {
    setupBadgesTab([], []);
    renderPage();
    await screen.findByRole('button', { name: /challenges/i });

    const challenge = makeChallenge({ title: 'Done Challenge', goal: 5 });
    const enrollment = makeEnrollment(challenge, {
      progress: 5,
      completed: true,
      completedAt: new Date().toISOString(),
    });
    setupChallengesTab([challenge], [enrollment]);
    fireEvent.click(screen.getByRole('button', { name: /challenges/i }));

    await waitFor(() => {
      // "Completed" appears as filter chip + progress label — check it's there multiple times
      const completedEls = screen.getAllByText('Completed');
      expect(completedEls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
