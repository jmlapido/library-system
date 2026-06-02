import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SchoolSettingsPage } from '../SchoolSettingsPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
  },
}));

import { api } from '@/lib/api';
const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;

const mockData = {
  info: { name: 'Test School', location: 'Manila' },
  settings: {
    studentCheckoutDays: 14, teacherCheckoutDays: 28,
    studentCheckoutLimit: 5, teacherCheckoutLimit: 15,
    fineEnabled: false, finePerDay: 0, overdueReminderDays: 2, timezone: 'Asia/Manila',
    reminderDaysBefore: [3, 1],
    overdueRepeatEvery: 2,
    notificationTime: '08:00',
    smsSenderId: 'LIBRARY',
  },
};

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('SchoolSettingsPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    expect(screen.getByText('Loading settings…')).toBeInTheDocument();
  });

  it('renders school name after data loads', async () => {
    mockGet.mockResolvedValue(mockData);
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByDisplayValue('Test School')).toBeInTheDocument());
  });

  it('renders checkout days fields', async () => {
    mockGet.mockResolvedValue(mockData);
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByLabelText('Student loan period (days)'));
    expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    expect(screen.getByDisplayValue('28')).toBeInTheDocument();
  });

  it('calls api.patch with form values on save', async () => {
    mockGet.mockResolvedValue(mockData);
    mockPatch.mockResolvedValue({ ...mockData.settings, studentCheckoutDays: 21 });
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByDisplayValue('14'));
    fireEvent.change(screen.getByLabelText('Student loan period (days)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/schools/settings', expect.objectContaining({ studentCheckoutDays: 21 })));
  });

  it('shows saved confirmation after successful save', async () => {
    mockGet.mockResolvedValue(mockData);
    mockPatch.mockResolvedValue(mockData.settings);
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByRole('button', { name: 'Save Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(screen.getByText('Settings saved.')).toBeInTheDocument());
  });

  it('shows fine amount field when fines enabled', async () => {
    mockGet.mockResolvedValue(mockData);
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByLabelText('Enable overdue fines'));
    fireEvent.click(screen.getByLabelText('Enable overdue fines'));
    await waitFor(() => expect(screen.getByLabelText('Fine per day (₱)')).toBeInTheDocument());
  });

  it('shows error message on save failure', async () => {
    mockGet.mockResolvedValue(mockData);
    mockPatch.mockRejectedValue(new Error('Server error'));
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByRole('button', { name: 'Save Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument());
  });

  it('shows error state when fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByText('Failed to load school settings.')).toBeInTheDocument());
  });

  it('renders Notification Settings section with correct fields', async () => {
    mockGet.mockResolvedValue(mockData);
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByText('Notification Settings'));
    expect(screen.getByLabelText('Reminder Days Before Due')).toBeInTheDocument();
    expect(screen.getByLabelText('Repeat overdue notice every X days')).toBeInTheDocument();
    expect(screen.getByLabelText('Daily send time (school local time)')).toBeInTheDocument();
    expect(screen.getByLabelText('SMS Sender Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3, 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LIBRARY')).toBeInTheDocument();
  });

  it('calls PATCH with notification fields in payload', async () => {
    mockGet.mockResolvedValue(mockData);
    mockPatch.mockResolvedValue(mockData.settings);
    render(<SchoolSettingsPage />, { wrapper: wrapper() });
    await waitFor(() => screen.getByLabelText('SMS Sender Name'));
    fireEvent.change(screen.getByLabelText('SMS Sender Name'), { target: { value: 'COOLSCHOOL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/schools/settings',
        expect.objectContaining({
          smsSenderId: 'COOLSCHOOL',
          reminderDaysBefore: [3, 1],
          overdueRepeatEvery: 2,
          notificationTime: '08:00',
        })
      )
    );
  });
});
