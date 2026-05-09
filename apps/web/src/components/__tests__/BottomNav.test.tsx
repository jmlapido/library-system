import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '../BottomNav';

describe('BottomNav', () => {
  it('renders four tabs', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('My Books')).toBeInTheDocument();
    expect(screen.getByText('Scan')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('each tab is a link with the correct href', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Search/i })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: /My Books/i })).toHaveAttribute('href', '/my-books');
    expect(screen.getByRole('link', { name: /Scan/i })).toHaveAttribute('href', '/scan');
    expect(screen.getByRole('link', { name: /Account/i })).toHaveAttribute('href', '/account');
  });

  it('marks the active route with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <BottomNav />
      </MemoryRouter>
    );
    const searchLink = screen.getByRole('link', { name: /Search/i });
    expect(searchLink).toHaveAttribute('aria-current', 'page');
    const myBooksLink = screen.getByRole('link', { name: /My Books/i });
    expect(myBooksLink).not.toHaveAttribute('aria-current', 'page');
  });
});
