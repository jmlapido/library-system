import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ReportsPage } from '../ReportsPage';
import type { AdminStats, OverdueItem, PopularBook, ActivityDay, InventoryAudit } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockStats: AdminStats = {
  totalBooks: 120,
  totalCopies: 200,
  totalUsers: 85,
  activeCheckouts: 30,
  overdueCheckouts: 5,
  holdsWaiting: 3,
  booksAvailable: 170,
};

const mockOverdue: OverdueItem[] = [
  {
    checkoutId: 'co-1',
    userId: 'u-1',
    userFullName: 'Ana Reyes',
    userGradeLevel: 7,
    bookTitle: 'Harry Potter',
    bookAuthor: 'J.K. Rowling',
    barcode: 'BC-001',
    checkedOutAt: '2026-04-01T00:00:00Z',
    dueDate: '2026-04-15T00:00:00Z',
    daysOverdue: 10,
  },
  {
    checkoutId: 'co-2',
    userId: 'u-2',
    userFullName: 'Ben Cruz',
    userGradeLevel: 8,
    bookTitle: 'Noli Me Tangere',
    bookAuthor: 'Jose Rizal',
    barcode: 'BC-002',
    checkedOutAt: '2026-05-01T00:00:00Z',
    dueDate: '2026-05-15T00:00:00Z',
    daysOverdue: 3,
  },
];

const mockPopular: PopularBook[] = [
  {
    bookId: 'b-1',
    title: 'Noli Me Tangere',
    author: 'Jose Rizal',
    genre: 'Historical Fiction',
    checkoutCount: 42,
    currentlyAvailable: true,
  },
];

const mockActivity: ActivityDay[] = [
  { date: '2026-05-01', checkouts: 5, returns: 3 },
  { date: '2026-05-02', checkouts: 7, returns: 4 },
];

const mockInventory: InventoryAudit = {
  statusBreakdown: [
    { status: 'available', count: 170 },
    { status: 'checked_out', count: 30 },
    { status: 'lost', count: 2 },
  ],
  lostCopies: [
    {
      copyId: 'cp-1',
      barcode: 'BC-LOST-1',
      bookTitle: 'El Filibusterismo',
      bookAuthor: 'Jose Rizal',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ReportsPage />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Reports" heading after data loads', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton initially', async () => {
    const { api } = await import('../../../lib/api');
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    renderPage();

    // Skeleton uses animate-pulse divs — loading state renders before data
    // The heading "Reports" should NOT be present while loading
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
  });

  it('shows 4 tabs: Overview, Overdue, Popular Books, Inventory', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument());
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Popular Books')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
  });

  it('shows stat cards after data loads', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Total Books')).toBeInTheDocument());
    expect(screen.getByText('Total Copies')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Active Checkouts')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('shows overdue items when Overdue tab is clicked', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByText('Overdue')[0]).toBeInTheDocument());
    await userEvent.click(screen.getAllByText('Overdue')[0]);

    await waitFor(() => {
      expect(screen.getByText('Ana Reyes')).toBeInTheDocument();
      expect(screen.getByText('Ben Cruz')).toBeInTheDocument();
    });
  });

  it('highlights rows with daysOverdue >= 7 in overdue tab', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByText('Overdue')[0]).toBeInTheDocument());
    await userEvent.click(screen.getAllByText('Overdue')[0]);

    await waitFor(() => expect(screen.getByText('Ana Reyes')).toBeInTheDocument());

    const anaRow = screen.getByText('Ana Reyes').closest('tr');
    expect(anaRow).toHaveClass('bg-red-50');

    const benRow = screen.getByText('Ben Cruz').closest('tr');
    expect(benRow).not.toHaveClass('bg-red-50');
  });

  it('shows popular books in Popular Books tab', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Popular Books')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Popular Books'));

    await waitFor(() => {
      expect(screen.getByText('Noli Me Tangere')).toBeInTheDocument();
      expect(screen.getByText('Jose Rizal')).toBeInTheDocument();
    });
  });

  it('shows inventory data in Inventory tab', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((path: string) => {
      if (path === '/admin/stats') return Promise.resolve(mockStats) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/overdue') return Promise.resolve(mockOverdue) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/popular') return Promise.resolve(mockPopular) as ReturnType<typeof api.get>;
      if (path === '/admin/reports/activity') return Promise.resolve(mockActivity) as ReturnType<typeof api.get>;
      if (path === '/admin/inventory/audit') return Promise.resolve(mockInventory) as ReturnType<typeof api.get>;
      return Promise.resolve(null) as ReturnType<typeof api.get>;
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Inventory')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Inventory'));

    await waitFor(() => {
      expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Lost Copies')).toBeInTheDocument();
      expect(screen.getByText('El Filibusterismo')).toBeInTheDocument();
    });
  });

  it('shows error card when API fails', async () => {
    const { api } = await import('../../../lib/api');
    const mockGet = vi.mocked(api.get);
    mockGet.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load reports data/i)
      ).toBeInTheDocument();
    });
  });
});
