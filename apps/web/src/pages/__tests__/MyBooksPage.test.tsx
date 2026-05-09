import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyBooksPage } from '../MyBooksPage';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockImplementation((path: string) => {
      if (path.includes('checkouts')) return Promise.resolve({ checkouts: [
        { id: 'co1', book: { title: 'Noli Me Tangere', author: 'Jose Rizal', genre: 'Fiction' },
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), renewalCount: 0, maxRenewals: 2 }
      ]});
      if (path.includes('holds')) return Promise.resolve({ holds: [] });
      return Promise.resolve({});
    }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('MyBooksPage', () => {
  it('shows checked out book', async () => {
    render(<MemoryRouter><MyBooksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Noli Me Tangere')).toBeInTheDocument());
  });
  it('shows Renew button', async () => {
    render(<MemoryRouter><MyBooksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Renew')).toBeInTheDocument());
  });
  it('shows empty holds message', async () => {
    render(<MemoryRouter><MyBooksPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/No holds placed/i)).toBeInTheDocument());
  });
});
