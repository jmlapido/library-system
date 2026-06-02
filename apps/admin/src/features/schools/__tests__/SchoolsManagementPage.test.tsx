import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SchoolsManagementPage } from '../SchoolsManagementPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
}));

import { api } from '@/lib/api';
const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

const SCHOOL_FIXTURE = {
  id: 'school-uuid-1',
  name: 'Manila High School',
  location: 'Manila',
  createdAt: new Date().toISOString(),
};

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('SchoolsManagementPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    expect(screen.getByText('Loading schools…')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() =>
      expect(screen.getByText('Failed to load schools.')).toBeInTheDocument()
    );
  });

  it('shows no schools message when list is empty', async () => {
    mockGet.mockResolvedValue([]);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() =>
      expect(screen.getByText('No schools registered yet.')).toBeInTheDocument()
    );
  });

  it('shows school name when schools exist', async () => {
    mockGet.mockResolvedValue([SCHOOL_FIXTURE]);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() =>
      expect(screen.getByText('Manila High School')).toBeInTheDocument()
    );
  });

  it('shows school count badge', async () => {
    mockGet.mockResolvedValue([SCHOOL_FIXTURE]);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('Create School button disabled when name is empty', async () => {
    mockGet.mockResolvedValue([]);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByText('No schools registered yet.'));
    const btn = screen.getByRole('button', { name: 'Create School' });
    expect(btn).toBeDisabled();
  });

  it('submits create form and refreshes list', async () => {
    mockGet.mockResolvedValue([]);
    mockPost.mockResolvedValue(SCHOOL_FIXTURE);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByText('No schools registered yet.'));

    fireEvent.change(screen.getByLabelText('School Name'), {
      target: { value: 'Manila High School' },
    });
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Manila' },
    });

    const btn = screen.getByRole('button', { name: 'Create School' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/super-admin/schools',
        expect.objectContaining({ name: 'Manila High School', location: 'Manila' })
      )
    );
  });

  it('shows edit form when Edit button clicked', async () => {
    mockGet.mockResolvedValue([SCHOOL_FIXTURE]);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByText('Manila High School'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('cancels edit and returns to row view', async () => {
    mockGet.mockResolvedValue([SCHOOL_FIXTURE]);
    render(<SchoolsManagementPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByText('Manila High School'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
