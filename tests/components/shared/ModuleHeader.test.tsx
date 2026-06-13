import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ModuleHeader } from '../../../src/components/shared/ModuleHeader';

describe('ModuleHeader', () => {
  it('renders the title as a heading', () => {
    render(<ModuleHeader title="Fleet Master" />);
    expect(screen.getByRole('heading', { name: 'Fleet Master' })).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<ModuleHeader title="Schedule" subtitle="2 upcoming" />);
    expect(screen.getByText('2 upcoming')).toBeInTheDocument();
  });

  it('omits subtitle element when not provided', () => {
    const { container } = render(<ModuleHeader title="Dashboard" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders action slot content when provided', () => {
    render(<ModuleHeader title="Issues" action={<button>+ Log</button>} />);
    expect(screen.getByRole('button', { name: '+ Log' })).toBeInTheDocument();
  });

  it('omits the action wrapper when no action is provided', () => {
    const { container } = render(<ModuleHeader title="Dashboard" />);
    // The shrink-0 wrapper div exists only when action is provided
    expect(container.querySelector('.shrink-0')).toBeNull();
  });

  it('applies items-start alignment when align="start"', () => {
    const { container } = render(<ModuleHeader title="Audits" align="start" />);
    expect(container.firstChild).toHaveClass('items-start');
  });

  it('defaults to items-center alignment', () => {
    const { container } = render(<ModuleHeader title="Audits" />);
    expect(container.firstChild).toHaveClass('items-center');
  });
});
