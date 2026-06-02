import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudentsPage } from '../StudentsPage';

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

const mockStudents = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Juan Dela Cruz',
    email: 'juan@school.edu',
    studentId: '2024-001',
    grade: 'Grade 5',
    role: 'student',
    approvalStatus: 'approved',
    activeCheckoutsCount: 2,
    createdAt: '2024-08-01T00:00:00.000Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Maria Santos',
    email: 'maria@school.edu',
    studentId: '2024-002',
    grade: 'Grade 6',
    role: 'student',
    approvalStatus: 'pending',
    activeCheckoutsCount: 0,
    createdAt: '2024-08-15T00:00:00.000Z',
  },
];

const mockCheckouts = [
  {
    id: 'cc111111-1111-1111-1111-111111111111',
    bookTitle: 'Noli Me Tangere',
    dueDate: '2024-09-01T00:00:00.000Z',
    status: 'overdue',
  },
  {
    id: 'cc222222-2222-2222-2222-222222222222',
    bookTitle: 'El Filibusterismo',
    dueDate: '2099-12-31T00:00:00.000Z',
    status: 'checked_out',
  },
];

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setup(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <StudentsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StudentsPage', () => {
  it('renders student table with data from API', async () => {
    const qc = makeQc();
    vi.mocked(api.get).mockResolvedValue(mockStudents);

    setup(qc);

    await waitFor(() =>
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    );
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('2024-001')).toBeInTheDocument();
    expect(screen.getByText('Grade 5')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading', () => {
    const qc = makeQc();
    // Never resolves — keeps loading state
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    setup(qc);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('opens student detail sheet on "View" click and shows profile info', async () => {
    const qc = makeQc();
    // First call: student list; subsequent: checkouts
    vi.mocked(api.get)
      .mockResolvedValueOnce(mockStudents)
      .mockResolvedValue(mockCheckouts);

    setup(qc);

    await waitFor(() => screen.getByText('Juan Dela Cruz'));

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    await userEvent.click(viewButtons[0]);

    // Sheet title should appear (name appears in table row + sheet header)
    await waitFor(() =>
      expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThanOrEqual(2)
    );

    // Profile data rendered in sheet (email appears in table + sheet)
    expect(screen.getAllByText('juan@school.edu').length).toBeGreaterThanOrEqual(1);
    // Grade appears in both table and sheet
    expect(screen.getAllByText('Grade 5').length).toBeGreaterThanOrEqual(1);

    // Checkout list loaded
    await waitFor(() =>
      expect(screen.getByText('Noli Me Tangere')).toBeInTheDocument()
    );
    expect(screen.getByText('El Filibusterismo')).toBeInTheDocument();

    // Overdue badge present for the overdue item
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('handles 404 gracefully — shows "Data unavailable" in sheet', async () => {
    const qc = makeQc();
    // Students load fine
    vi.mocked(api.get)
      .mockResolvedValueOnce(mockStudents)
      .mockRejectedValue({ status: 404, code: 'NOT_FOUND', message: 'Not found' });

    setup(qc);

    await waitFor(() => screen.getByText('Juan Dela Cruz'));

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    await userEvent.click(viewButtons[0]);

    // Name appears in table row + sheet header after open
    await waitFor(() =>
      expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThanOrEqual(2)
    );

    // Checkouts query fails — show unavailable message
    await waitFor(() =>
      expect(screen.getByText(/data unavailable/i)).toBeInTheDocument()
    );
  });

  it('shows "No students found." when roster is empty', async () => {
    const qc = makeQc();
    vi.mocked(api.get).mockResolvedValue([]);

    setup(qc);

    await waitFor(() =>
      expect(screen.getByText('No students found.')).toBeInTheDocument()
    );
  });
});
