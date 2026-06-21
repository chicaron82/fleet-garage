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
  it('a saved custom order wins outright', () => {
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

  it('returns a copy, not the input array', () => {
    const result = orderQuickTaps(taps, null, null);
    expect(result).not.toBe(taps);
  });

  it('exposes the visible-count constant', () => {
    expect(QUICK_START_VISIBLE).toBe(4);
  });
});
