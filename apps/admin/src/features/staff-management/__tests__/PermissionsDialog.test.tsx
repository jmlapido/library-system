import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionsDialog } from '../PermissionsDialog';

vi.mock('../../../lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));
import { api } from '../../../lib/api';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const staffAdmin = { id: 'u1', fullName: 'Alice Admin', role: 'admin' };
const staffAssistant = { id: 'u2', fullName: 'Bob Asst', role: 'library_assistant' };

function setup(staff: typeof staffAdmin | typeof staffAssistant | null, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <QueryClientProvider client={qc}>
        <PermissionsDialog staff={staff} onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  qc.clear();
  vi.clearAllMocks();
});

describe('PermissionsDialog', () => {
  it('renders nothing when staff is null', () => {
    setup(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows all permissions for admin (all floor)', async () => {
    vi.mocked(api.get).mockResolvedValue({ permissions: [] });
    setup(staffAdmin);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    // All checkboxes should be disabled (floor) for admin role
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
  });

  it('shows toggleable permissions for library_assistant', async () => {
    vi.mocked(api.get).mockResolvedValue({ permissions: ['catalog.view'] });
    setup(staffAssistant);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    // library_assistant floor is empty, so all checkboxes are enabled
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).not.toBeDisabled());
  });

  it('calls PATCH on save with current checked set', async () => {
    vi.mocked(api.get).mockResolvedValue({ permissions: ['catalog.view'] });
    vi.mocked(api.patch).mockResolvedValue({});
    const { onClose } = setup(staffAssistant);
    await waitFor(() => screen.getByRole('dialog'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        `/admin/staff/${staffAssistant.id}/permissions`,
        { permissions: ['catalog.view'] },
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('Cancel button triggers onClose', async () => {
    vi.mocked(api.get).mockResolvedValue({ permissions: [] });
    const { onClose } = setup(staffAssistant);
    await waitFor(() => screen.getByRole('dialog'));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
