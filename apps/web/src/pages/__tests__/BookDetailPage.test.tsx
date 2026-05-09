import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookDetailPage } from '../BookDetailPage';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      id: 'book-1', title: 'Noli Me Tangere', author: 'Jose Rizal',
      genre: 'Fiction', readingLevel: 'Grade 9', availableCopies: 3, totalCopies: 3,
      description: 'A social novel.', coverUrl: null,
      isbn: '978-971', publisher: 'National Book', publicationYear: 1887, language: 'Filipino',
      pageCount: 302, subjectTags: [], deweyDecimal: null, schoolId: 's1', createdAt: '2024-01-01',
    }),
    post: vi.fn(),
  },
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/book/book-1']}>
      <Routes><Route path="/book/:id" element={<BookDetailPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('BookDetailPage', () => {
  it('shows book title after load', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getAllByText('Noli Me Tangere').length).toBeGreaterThan(0));
  });
  it('shows separate Checkout and Place Hold buttons', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Checkout')).toBeInTheDocument();
      expect(screen.getByText('Place Hold')).toBeInTheDocument();
    });
  });
  it('shows About, Copies, Related tabs', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument();
      expect(screen.getByText('Copies')).toBeInTheDocument();
      expect(screen.getByText('Related')).toBeInTheDocument();
    });
  });
});
