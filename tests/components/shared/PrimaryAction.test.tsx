import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PrimaryAction } from '../../../src/components/shared/PrimaryAction';

describe('PrimaryAction', () => {
  it('renders a button with + prefix and label', () => {
    render(<PrimaryAction label="Log Issue" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: '+ Log Issue' })).toBeInTheDocument();
  });

  it('carries the fg-yellow accent class — the design-language invariant', () => {
    render(<PrimaryAction label="Register" onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveClass('bg-fg-yellow');
  });

  it('calls onClick when clicked', () => {
    const handler = vi.fn();
    render(<PrimaryAction label="Log" onClick={handler} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('is disabled and not clickable when disabled prop is set', () => {
    const handler = vi.fn();
    render(<PrimaryAction label="Register" onClick={handler} disabled />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(handler).not.toHaveBeenCalled();
  });

  it('uses aria-label for screen readers when provided', () => {
    render(<PrimaryAction label="Log" onClick={() => {}} aria-label="Log new issue" />);
    expect(screen.getByRole('button', { name: 'Log new issue' })).toBeInTheDocument();
  });
});
