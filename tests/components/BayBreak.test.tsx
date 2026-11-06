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
