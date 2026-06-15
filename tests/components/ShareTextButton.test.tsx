import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareTextButton } from '../../src/components/shared/ShareTextButton';

// ShareTextButton is the block sibling of ShareAction — the export sheets' amber
// "share as text" option. It exists as a component (not a copied className) so the
// share lane can't drift back to gray on the next sheet. These cases are that guard.

describe('ShareTextButton', () => {
  it('renders as "↗ {label}", defaulting to Plain Text', () => {
    const { rerender } = render(<ShareTextButton onClick={vi.fn()} copied={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('↗ Plain Text');
    rerender(<ShareTextButton onClick={vi.fn()} copied={false} label="OTH Report" />);
    expect(screen.getByRole('button')).toHaveTextContent('↗ OTH Report');
  });

  it('shows ✓ Copied after a clipboard fallback', () => {
    render(<ShareTextButton onClick={vi.fn()} copied />);
    expect(screen.getByRole('button')).toHaveTextContent('✓ Copied');
  });

  it('shows the loading label, which wins over copied', () => {
    render(<ShareTextButton onClick={vi.fn()} copied loading />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('Generating…');
    expect(btn).not.toHaveTextContent('Copied');
  });

  it('wears the amber share lane — never the gray it replaced', () => {
    render(<ShareTextButton onClick={vi.fn()} copied={false} />);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('text-amber-700')).toBe(true);
    expect(btn.classList.contains('text-gray-700')).toBe(false);
  });

  it('fires onClick when tapped, and is inert while disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ShareTextButton onClick={onClick} copied={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<ShareTextButton onClick={onClick} copied={false} disabled />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
