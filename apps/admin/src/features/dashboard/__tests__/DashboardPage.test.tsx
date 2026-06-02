import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardPage } from '../DashboardPage';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_DATA = {
  success: true,
  data: {
    checkoutsToday: 12,
    currentlyOverdue: 5,
    activeHolds: 8,
    booksOutNow: 47,
    recentActivity: [
      {
        type: 'checkout' as const,
        bookTitle: 'The Hobbit',
        userName: 'Juan dela Cruz',
        timestamp: new Date('2026-06-02T09:00:00Z').toISOString(),
      },
      {
        type: 'return' as const,
        bookTitle: 'Noli Me Tangere',
        userName: 'Maria Santos',
        timestamp: new Date('2026-06-02T08:30:00Z').toISOString(),
      },
    ],
  },
};

function mockFetchSuccess(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

function mockFetchFailure(status = 500) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: async () => ({}),
  } as Response);
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  beforeEach(() => {
    // Set a fake token so auth header is included
    useAuthStore.setState({ accessToken: 'test-token', user: null, refreshToken: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ accessToken: null, user: null, refreshToken: null });
  });

  it('renders stat cards when API returns data', async () => {
    mockFetchSuccess(MOCK_DATA);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Checkouts Today')).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Currently Overdue')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Active Holds')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Books Out Now')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
  });

  it('shows skeleton loader while loading', () => {
    // Never resolves during this check
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByLabelText('Loading activity')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    mockFetchFailure(500);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert').textContent).toMatch(/500/);
  });

  it('activity feed renders items', async () => {
    mockFetchSuccess(MOCK_DATA);
    renderDashboard();

    // Titles are embedded inside spans with surrounding text nodes — use regex
    await waitFor(() => {
      expect(screen.getByText(/The Hobbit/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Noli Me Tangere/)).toBeInTheDocument();
    expect(screen.getByText(/Juan dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText(/Maria Santos/)).toBeInTheDocument();

    // Badge labels
    expect(screen.getByText('Checkout')).toBeInTheDocument();
    expect(screen.getByText('Return')).toBeInTheDocument();
  });

  it('shows "No recent activity" when recentActivity is empty', async () => {
    mockFetchSuccess({
      ...MOCK_DATA,
      data: { ...MOCK_DATA.data, recentActivity: [] },
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No recent activity.')).toBeInTheDocument();
    });
  });

  it('renders quick action buttons', async () => {
    mockFetchSuccess(MOCK_DATA);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Go to Circulation')).toBeInTheDocument();
    });

    expect(screen.getByText('Go to Shelving Queue')).toBeInTheDocument();
  });
});
