import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModuleHeader } from '../../src/components/shared/ModuleHeader';
import { PrimaryAction } from '../../src/components/shared/PrimaryAction';

// These two shared primitives exist so a module's title block and its primary
// create-action can't drift apart again (headers had splintered on size and
// alignment; "add" buttons lived in four different places and colours). The
// contracts under test ARE the parts that hold the design language in place.

describe('PrimaryAction', () => {
  it('always renders as "+ {label}"', () => {
    render(<PrimaryAction label="Log" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('+ Log');
  });

  it('fires onClick when tapped', () => {
    const onClick = vi.fn();
    render(<PrimaryAction label="Register" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick while disabled', () => {
    const onClick = vi.fn();
    render(<PrimaryAction label="Audit" onClick={onClick} disabled />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards aria-label for screen readers', () => {
    render(<PrimaryAction label="Log" aria-label="Log a found item" onClick={vi.fn()} />);
    expect(screen.getByLabelText('Log a found item')).toBeInTheDocument();
  });

  it('wears the fg-yellow brand token — never a raw colour', () => {
    // The whole point of the consolidation: one accent, one source of truth.
    // classList.contains is an exact token match, so this stays true even though
    // the hover class (hover:bg-fg-yellow-hi) shares the substring.
    render(<PrimaryAction label="Log" onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('bg-fg-yellow')).toBe(true);
    expect(btn.classList.contains('bg-yellow-400')).toBe(false);
  });
});

describe('ModuleHeader', () => {
  it('renders the title as the page h1', () => {
    render(<ModuleHeader title="Lost & Found" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Lost & Found');
  });

  it('renders an inline subtitle when given', () => {
    render(<ModuleHeader title="Issue Log" subtitle="3 open issues" />);
    expect(screen.getByText('3 open issues')).toBeInTheDocument();
  });

  it('omits the subtitle paragraph when none is given', () => {
    const { container } = render(<ModuleHeader title="Manifest" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders the action slot when given', () => {
    render(<ModuleHeader title="Audits" action={<span data-testid="slot">+ Audit</span>} />);
    expect(screen.getByTestId('slot')).toBeInTheDocument();
  });

  it('omits the action wrapper when no action is given', () => {
    render(<ModuleHeader title="Analytics" />);
    expect(screen.queryByTestId('slot')).toBeNull();
  });

  it('defaults to center alignment and honours align="start"', () => {
    const { container: centered } = render(<ModuleHeader title="A" />);
    expect((centered.firstChild as HTMLElement).classList.contains('items-center')).toBe(true);

    const { container: start } = render(<ModuleHeader title="B" align="start" />);
    expect((start.firstChild as HTMLElement).classList.contains('items-start')).toBe(true);
  });
});
