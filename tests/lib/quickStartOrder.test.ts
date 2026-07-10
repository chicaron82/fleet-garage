import { describe, it, expect } from 'vitest';
import { userShiftTypeOn, orderQuickTaps, QUICK_START_VISIBLE } from '../../src/lib/quickStartOrder';
import type { QuickTap } from '../../src/hooks/useOffStandardSession';

const tap = (id: string): QuickTap => ({ id } as QuickTap);
const ids = (taps: QuickTap[]) => taps.map(t => t.id);

// default order used across the ordering tests
const taps = [tap('a'), tap('opening_duties'), tap('closing_duties'), tap('b')];

describe('userShiftTypeOn', () => {
  const shifts = [
    { userId: 'me', date: '2026-06-15', shiftType: 'opening' as const },
    { userId: 'you', date: '2026-06-15', shiftType: 'closing' as const },
  ];

  it("returns the user's shift type for that date", () => {
    expect(userShiftTypeOn(shifts, 'me', '2026-06-15')).toBe('opening');
  });

  it('returns null when not rostered that day', () => {
    expect(userShiftTypeOn(shifts, 'me', '2026-06-16')).toBeNull();
    expect(userShiftTypeOn(shifts, 'ghost', '2026-06-15')).toBeNull();
  });
});

describe('orderQuickTaps', () => {
  it('a saved custom order is preserved as-is with no shift context', () => {
    expect(ids(orderQuickTaps(taps, ['b', 'a'], null))).toEqual(['b', 'a', 'opening_duties', 'closing_duties']);
  });

  it('appends presets missing from a saved order so none disappear', () => {
    expect(ids(orderQuickTaps(taps, ['closing_duties'], null)))
      .toEqual(['closing_duties', 'a', 'opening_duties', 'b']);
  });

  it('promotes opening duties to the front for an opening shift', () => {
    expect(ids(orderQuickTaps(taps, null, 'opening'))[0]).toBe('opening_duties');
  });

  it('promotes closing duties to the front for a closing shift', () => {
    expect(ids(orderQuickTaps(taps, null, 'closing'))[0]).toBe('closing_duties');
  });

  it('leaves the default order untouched for mid/none', () => {
    expect(ids(orderQuickTaps(taps, null, 'mid'))).toEqual(['a', 'opening_duties', 'closing_duties', 'b']);
    expect(ids(orderQuickTaps(taps, null, null))).toEqual(['a', 'opening_duties', 'closing_duties', 'b']);
  });

  // The fix: schedule-aware promotion now layers ON TOP of a saved custom order,
  // instead of being skipped whenever the user had customized (the "Closing
  // Duties on an opening shift" bug, 2026-07-03).
  it('floats the opening duty to the front on top of a saved order', () => {
    expect(ids(orderQuickTaps(taps, ['b', 'a'], 'opening')))
      .toEqual(['opening_duties', 'b', 'a', 'closing_duties']);
  });

  it('floats the closing duty to the front on top of a saved order', () => {
    expect(ids(orderQuickTaps(taps, ['b', 'a'], 'closing')))
      .toEqual(['closing_duties', 'b', 'a', 'opening_duties']);
  });

  it('dedups a duty already in the saved order so it leads exactly once', () => {
    const out = ids(orderQuickTaps(taps, ['opening_duties', 'b'], 'opening'));
    expect(out).toEqual(['opening_duties', 'b', 'a', 'closing_duties']);
    expect(out.filter(id => id === 'opening_duties')).toHaveLength(1);
  });

  // The swap: the OPPOSITE duty must drop out of the visible pills, not just sit behind the
  // promoted one — the "showing both Opening and Closing on an opening shift" bug (2026-07-10).
  const many = [tap('opening_duties'), tap('closing_duties'), tap('a'), tap('b'), tap('c'), tap('d')];

  it('demotes closing duties past the visible fold on an opening shift', () => {
    const out = ids(orderQuickTaps(many, null, 'opening'));
    expect(out[0]).toBe('opening_duties');
    expect(out.indexOf('closing_duties')).toBe(out.length - 1);            // tucked into "more"
    expect(out.indexOf('closing_duties')).toBeGreaterThanOrEqual(QUICK_START_VISIBLE);
  });

  it('demotes opening duties past the visible fold on a closing shift', () => {
    const out = ids(orderQuickTaps(many, null, 'closing'));
    expect(out[0]).toBe('closing_duties');
    expect(out.indexOf('opening_duties')).toBe(out.length - 1);
    expect(out.indexOf('opening_duties')).toBeGreaterThanOrEqual(QUICK_START_VISIBLE);
  });

  it('leaves a saved order untouched on a mid shift (no duty to float)', () => {
    expect(ids(orderQuickTaps(taps, ['b', 'a'], 'mid')))
      .toEqual(['b', 'a', 'opening_duties', 'closing_duties']);
  });

  it('an empty saved order [] falls back to the schedule-aware default', () => {
    expect(ids(orderQuickTaps(taps, [], 'closing'))[0]).toBe('closing_duties');
  });

  it('returns a copy, not the input array', () => {
    const result = orderQuickTaps(taps, null, null);
    expect(result).not.toBe(taps);
  });

  it('exposes the visible-count constant', () => {
    expect(QUICK_START_VISIBLE).toBe(4);
  });
});
