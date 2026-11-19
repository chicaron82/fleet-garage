// On break (migration 166, docs/ticket-lot-bay-on-break.md): one quiet button off a break, a strip with Back on one.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BayBreakButton, BayBreakStrip } from '../../src/components/lot/BayBreak';

describe('BayBreak', () => {
  it('On break is one tap', () => {
    const onBreak = vi.fn();
    render(<BayBreakButton onBreak={onBreak} />);
    fireEvent.click(screen.getByRole('button', { name: 'On break' }));
    expect(onBreak).toHaveBeenCalledOnce();
  });

  it('⭐ on a break: says what the read-only page shows, that any tap ends it, and Back', () => {
    const onBack = vi.fn();
    render(<BayBreakStrip onBack={onBack} />);
    expect(screen.getByRole('status').textContent).toMatch(/On break\. The read-only page says the count is paused\. Any tap ends it\./);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// Pulled away (2026-11-19, migration 171, docs/ticket-lot-bay-pulled-away.md). Aaron: *"What about a generic pause when
// pulled. Could be driving. Maybe a meeting or doing something else"*.
describe('BayBreak, pulled away', () => {
  it('⭐ the second button says Pulled away', () => {
    const onPull = vi.fn();
    render(<BayBreakButton kind="pulled" onBreak={onPull} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pulled away' }));
    expect(onPull).toHaveBeenCalledOnce();
  });

  it('⭐ pulled away, the strip names it, and Back still ends it', () => {
    const onBack = vi.fn();
    render(<BayBreakStrip kind="pulled" onBack={onBack} />);
    expect(screen.getByRole('status').textContent).toMatch(/^Pulled away\. The read-only page says the count is paused\. Any tap ends it\./);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
