import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchPage } from '../SearchPage';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ hits: [], totalHits: 0 }),
  },
}));

describe('SearchPage', () => {
  it('renders search bar', () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/Search books/i)).toBeInTheDocument();
  });

  it('renders All genre chip', () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows no-results message when empty', async () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/No books found/i)).toBeInTheDocument();
    });
  });
});
