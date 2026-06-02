import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BulkImportPage } from '../BulkImportPage';

vi.mock('@/lib/api', () => ({
  api: {
    upload: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

import { api } from '@/lib/api';

const mockUpload = api.upload as ReturnType<typeof vi.fn>;

function makeCsvFile(name = 'students.csv') {
  return new File(['fullName,studentId\nJuan,2024-001'], name, { type: 'text/csv' });
}

describe('BulkImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Students and Books tabs', () => {
    render(<BulkImportPage />);
    expect(screen.getByRole('tab', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Books' })).toBeInTheDocument();
  });

  it('shows Students tab content by default', () => {
    render(<BulkImportPage />);
    expect(screen.getByText('Import Students')).toBeInTheDocument();
  });

  it('shows Books tab content when Books tab clicked', async () => {
    render(<BulkImportPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Books' }));
    await waitFor(() => {
      expect(screen.getByText('Import Books')).toBeInTheDocument();
    });
  });

  it('shows template download button', () => {
    render(<BulkImportPage />);
    expect(screen.getByRole('button', { name: 'Download CSV Template' })).toBeInTheDocument();
  });

  it('shows import button after file selected', async () => {
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import Students' })).toBeInTheDocument();
    });
  });

  it('shows Clear button after file selected', async () => {
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });
  });

  it('clears file when Clear is clicked', async () => {
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Import Students' })).not.toBeInTheDocument();
    });
  });

  it('calls api.upload with correct endpoint on submit', async () => {
    mockUpload.mockResolvedValueOnce({ inserted: 2, updated: 0, skipped: 0, errors: [] });
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => screen.getByRole('button', { name: 'Import Students' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Students' }));
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith('/users/import', expect.any(FormData));
    });
  });

  it('shows student import results after successful upload', async () => {
    mockUpload.mockResolvedValueOnce({ inserted: 3, updated: 1, skipped: 0, errors: [] });
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => screen.getByRole('button', { name: 'Import Students' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Students' }));
    await waitFor(() => {
      expect(screen.getByText('3 inserted')).toBeInTheDocument();
      expect(screen.getByText('1 updated')).toBeInTheDocument();
    });
  });

  it('shows row errors table when import has errors', async () => {
    mockUpload.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      skipped: 1,
      errors: [{ row: 3, message: 'studentId is required' }],
    });
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => screen.getByRole('button', { name: 'Import Students' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Students' }));
    await waitFor(() => {
      expect(screen.getByText('Row errors (1)')).toBeInTheDocument();
      expect(screen.getByText('studentId is required')).toBeInTheDocument();
    });
  });

  it('shows error message when upload fails', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Network error'));
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    await waitFor(() => screen.getByRole('button', { name: 'Import Students' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Students' }));
    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  it('rejects non-CSV files', async () => {
    render(<BulkImportPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const txtFile = new File(['data'], 'data.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [txtFile] } });
    await waitFor(() => {
      expect(screen.getByText('Only CSV files are accepted.')).toBeInTheDocument();
    });
  });

  it('shows books import results on Books tab', async () => {
    mockUpload.mockResolvedValueOnce({
      booksCreated: 5,
      booksUpdated: 2,
      copiesCreated: 10,
      errors: [],
    });
    render(<BulkImportPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Books' }));
    await waitFor(() => screen.getByText('Import Books'));
    const booksPanel = document.querySelector('[role="tabpanel"]:not([hidden])') as HTMLElement;
    const bookInput = booksPanel.querySelector('input[type="file"]') as HTMLInputElement;
    const bookFile = new File(['title,author\nDune,Herbert'], 'books.csv', { type: 'text/csv' });
    fireEvent.change(bookInput, { target: { files: [bookFile] } });
    await waitFor(() => screen.getByRole('button', { name: 'Import Books' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import Books' }));
    await waitFor(() => {
      expect(screen.getByText('5 books created')).toBeInTheDocument();
      expect(screen.getByText('10 copies created')).toBeInTheDocument();
    });
  });
});
