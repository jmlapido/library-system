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
});
