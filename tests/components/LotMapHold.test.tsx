// Lot Lookout's hold-to-take. Aaron, 2026-10-15: *"so even if the finger lands on a colour as long as it's on the
// right stall it works"*. The risk the hold carries is a DOUBLE write: the hold marks the stall taken, and the click
// that ends it also lands on the swatch under the finger. These pin that a hold writes taken ONCE, and a plain tap
// still writes its colour.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LotMap } from '../../src/components/lot/LotMap';
import { HOLD_MS, type LotStall } from '../../src/lib/lotLookout';

const stalls: LotStall[] = [
  { stall: 'P3', run: 'P', num: 3, state: 'open', tappedBy: null, tappedAt: null },
  { stall: 'P4', run: 'P', num: 4, state: 'taken', tappedBy: 'AS', tappedAt: '2026-10-15T00:00:00Z' },
];
const aisle = { cars: 0, tappedBy: null, tappedAt: null };
const NOW = Date.parse('2026-10-15T12:00:00Z');

describe('LotMap hold-to-take', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const setup = () => {
    const onTap = vi.fn();
    render(<LotMap stalls={stalls} aisle={aisle} nowMs={NOW} nPulse={false} onTap={onTap} onAisle={vi.fn()} />);
    return { onTap, clean: screen.getByRole('button', { name: 'P3 clean' }) };
  };

  it('⚠️ a hold that lands on a colour marks the stall taken, ONCE — the colour under the finger never fires', () => {
    const { onTap, clean } = setup();
    fireEvent.pointerDown(clean, { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    fireEvent.pointerUp(clean);
    fireEvent.click(clean);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith('P3', 'taken');
  });

  it('a quick tap is still just the colour', () => {
    const { onTap, clean } = setup();
    fireEvent.pointerDown(clean, { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(HOLD_MS - 100); });
    fireEvent.pointerUp(clean);
    fireEvent.click(clean);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith('P3', 'clean');
  });

  it('a finger that slides (a scroll) is not a hold', () => {
    const { onTap, clean } = setup();
    fireEvent.pointerDown(clean, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(clean, { clientX: 10, clientY: 40 });
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('the read-only map (FG\'s My Day) shows taken but has nothing to hold', () => {
    const onTap = vi.fn();
    const { container } = render(<LotMap stalls={stalls} aisle={aisle} nowMs={NOW} nPulse={false} />);
    expect(screen.queryByRole('button', { name: 'P3 clean' })).toBeNull();
    const p4 = container.querySelector('[data-stall="P4"]')!;
    expect(p4.className).toContain('bg-gray-500');
    fireEvent.pointerDown(p4);
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(onTap).not.toHaveBeenCalled();
  });
});
