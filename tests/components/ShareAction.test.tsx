import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareAction } from '../../src/components/shared/ShareAction';

// ShareAction is the one share affordance: every "↗ Share" reads the same (amber),
// flips to "✓ Copied" on the clipboard fallback, and runs the same native-share →
// clipboard dance. The contract under test IS what holds the share language in place
// (three cards had drifted on glyph, label, colour, and re-implemented the fallback).

const build = () => ({ title: 'A thing', text: 'the body to share' });

describe('ShareAction', () => {
  beforeEach(() => {
    // No native share → forces the clipboard fallback path.
    // @ts-expect-error — deleting an optional DOM API for the test
    delete navigator.share;
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders as "↗ {label}", defaulting to Share', () => {
    const { rerender } = render(<ShareAction build={build} />);
    expect(screen.getByRole('button')).toHaveTextContent('↗ Share');
    rerender(<ShareAction build={build} label="Share log" />);
    expect(screen.getByRole('button')).toHaveTextContent('↗ Share log');
  });

  it('renders glyph-only when compact', () => {
    render(<ShareAction build={build} compact />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('↗');
    expect(btn).not.toHaveTextContent('Share');
  });

  it('wears the amber share lane — never the yellow action token', () => {
    render(<ShareAction build={build} />);
    const btn = screen.getByRole('button');
    expect(btn.classList.contains('text-amber-600')).toBe(true);
    expect(btn.classList.contains('bg-fg-yellow')).toBe(false);
  });

  it('builds on click and flips to "✓ Copied" via the clipboard fallback', async () => {
    render(<ShareAction build={build} />);
    fireEvent.click(screen.getByRole('button'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('the body to share');
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('✓ Copied'));
  });

  it('shows the bare ✓ in compact mode after copying', async () => {
    render(<ShareAction build={build} compact />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toHaveTextContent('✓');
      expect(btn).not.toHaveTextContent('Copied');
    });
  });

  it('defaults the spoken label to "Share"', () => {
    render(<ShareAction build={build} compact />);
    expect(screen.getByLabelText('Share')).toBeInTheDocument();
  });

  it('stops propagation so it is safe on a clickable card', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <ShareAction build={build} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
