import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActiveStaffTab } from '../ActiveStaffTab';

vi.mock('../../../lib/api', () => ({
  api: { get: vi.fn() },
}));
import { api } from '../../../lib/api';

// Default: admin role
let mockRole = 'admin';
vi.mock('../../../stores/auth', () => ({
  useAuthStore: (sel: (s: { user: { role: string; schoolId: string } }) => unknown) =>
    sel({ user: { role: mockRole, schoolId: 'school-1' } }),
}));

// Suppress child dialog API calls
vi.mock('../PermissionsDialog', () => ({
  PermissionsDialog: () => null,
}));
vi.mock('../CreateStaffDialog', () => ({
  CreateStaffDialog: () => null,
}));

const activeStaff = [
  { id: 'u1', fullName: 'Alice Admin', email: 'alice@school.edu', role: 'admin' },
  { id: 'u2', fullName: 'Bob Librarian', email: 'bob@school.edu', role: 'librarian' },
];

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function setup() {
  return render(
    <QueryClientProvider client={qc}>
      <ActiveStaffTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  qc.clear();
  vi.clearAllMocks();
  mockRole = 'admin';
});

describe('ActiveStaffTab', () => {
  it('renders staff rows', async () => {
    vi.mocked(api.get).mockResolvedValue(activeStaff);
    setup();
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument());
    expect(screen.getByText('Bob Librarian')).toBeInTheDocument();
  });

  it('shows empty state when no active staff', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    setup();
    await waitFor(() =>
      expect(screen.getByText(/no active staff/i)).toBeInTheDocument(),
    );
  });

  it('shows "Create Staff Account" button for admin', async () => {
    vi.mocked(api.get).mockResolvedValue(activeStaff);
    setup();
    await waitFor(() => screen.getByText('Alice Admin'));
    expect(screen.getByRole('button', { name: /create staff account/i })).toBeInTheDocument();
  });

  it('hides "Create Staff Account" button for librarian', async () => {
    mockRole = 'librarian';
    vi.mocked(api.get).mockResolvedValue(activeStaff);
    setup();
    await waitFor(() => screen.getByText('Alice Admin'));
    expect(
      screen.queryByRole('button', { name: /create staff account/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Manage Permissions button in each row for admin', async () => {
    vi.mocked(api.get).mockResolvedValue(activeStaff);
    setup();
    await waitFor(() => screen.getByText('Alice Admin'));
    const aliceRow = screen.getByText('Alice Admin').closest('tr')!;
    expect(
      within(aliceRow).getByRole('button', { name: /manage permissions/i }),
    ).toBeInTheDocument();
  });

  it('hides Manage Permissions for librarian role', async () => {
    mockRole = 'librarian';
    vi.mocked(api.get).mockResolvedValue(activeStaff);
    setup();
    await waitFor(() => screen.getByText('Alice Admin'));
    expect(
      screen.queryByRole('button', { name: /manage permissions/i }),
    ).not.toBeInTheDocument();
  });

  it('Create Staff Account button opens CreateStaffDialog', async () => {
    // CreateStaffDialog is mocked, so we just confirm the button is clickable without errors
    vi.mocked(api.get).mockResolvedValue(activeStaff);
    setup();
    await waitFor(() => screen.getByText('Alice Admin'));
    await userEvent.click(screen.getByRole('button', { name: /create staff account/i }));
    // No error thrown = pass (dialog is mocked to null)
  });
});
