import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('shows green for available', () => {
    render(<StatusBadge available={3} total={5} />);
    expect(screen.getByText('✓ Available')).toBeInTheDocument();
  });

  it('shows amber for checked out', () => {
    render(<StatusBadge available={0} total={2} />);
    expect(screen.getByText('Checked out')).toBeInTheDocument();
  });
});
