import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';

vi.mock('../../lib/api', () => ({
  api: { post: vi.fn() },
}));

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

describe('LoginPage', () => {
  it('renders identifier field', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Email or Student ID')).toBeInTheDocument();
  });

  it('shows PIN label when input looks like student ID', () => {
    renderLogin();
    const input = screen.getByPlaceholderText('Email or Student ID');
    fireEvent.change(input, { target: { value: '2024-001' } });
    expect(screen.getByText(/Student ID detected/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('PIN')).toBeInTheDocument();
  });

  it('shows Password label when input looks like email', () => {
    renderLogin();
    const input = screen.getByPlaceholderText('Email or Student ID');
    fireEvent.change(input, { target: { value: 'maria@school.edu' } });
    expect(screen.getByText(/Email detected/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });
});
