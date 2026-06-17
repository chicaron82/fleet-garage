import { describe, it, expect } from 'vitest';
import { orderQuickTaps, userShiftTypeOn, QUICK_START_VISIBLE } from './quickStartOrder';
import { QUICK_TAPS } from '../hooks/useOffStandardSession';
import type { ShiftType } from '../types';

const ids = (taps: { id: string }[]) => taps.map(t => t.id);

describe('userShiftTypeOn', () => {
  const shifts = [
    { userId: 'u1', date: '2026-06-17', shiftType: 'closing' as ShiftType },
    { userId: 'u2', date: '2026-06-17', shiftType: 'opening' as ShiftType },
    { userId: 'u1', date: '2026-06-16', shiftType: 'opening' as ShiftType },
  ];
  it("returns the user's shift type for the date", () => {
    expect(userShiftTypeOn(shifts, 'u1', '2026-06-17')).toBe('closing');
    expect(userShiftTypeOn(shifts, 'u2', '2026-06-17')).toBe('opening');
  });
  it('returns null when the user is not rostered that day', () => {
    expect(userShiftTypeOn(shifts, 'u1', '2026-06-18')).toBeNull();
    expect(userShiftTypeOn(shifts, 'u3', '2026-06-17')).toBeNull();
  });
});

describe('orderQuickTaps', () => {
  it('keeps the default order when no saved order and no open/close shift', () => {
    expect(ids(orderQuickTaps(QUICK_TAPS, null, 'mid'))).toEqual(ids(QUICK_TAPS));
    expect(ids(orderQuickTaps(QUICK_TAPS, null, null))).toEqual(ids(QUICK_TAPS));
  });

  it('Tier 1: an opening shift promotes Opening Duties into the top 4', () => {
    const out = orderQuickTaps(QUICK_TAPS, null, 'opening');
    expect(out[0].id).toBe('opening_duties');
    expect(ids(out.slice(0, QUICK_START_VISIBLE))).toContain('opening_duties');
  });

  it('Tier 1: a closing shift promotes Closing Duties into the top 4', () => {
    const out = orderQuickTaps(QUICK_TAPS, null, 'closing');
    expect(out[0].id).toBe('closing_duties');
    expect(ids(out.slice(0, QUICK_START_VISIBLE))).toContain('closing_duties');
  });

  it('promotion preserves all presets (nothing dropped)', () => {
    const out = orderQuickTaps(QUICK_TAPS, null, 'closing');
    expect(out).toHaveLength(QUICK_TAPS.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(QUICK_TAPS)));
  });

  it('Tier 2: a saved custom order wins, and overrides the schedule promotion', () => {
    const saved = ['other', 'edv', 'fleeting_cars', 'training'];
    const out = orderQuickTaps(QUICK_TAPS, saved, 'opening'); // opening would promote — but custom wins
    expect(ids(out).slice(0, 4)).toEqual(saved);
    expect(out[0].id).not.toBe('opening_duties');
  });

  it('Tier 2: presets missing from a saved order are appended (nothing disappears)', () => {
    const saved = ['edv', 'other'];
    const out = orderQuickTaps(QUICK_TAPS, saved, null);
    expect(ids(out).slice(0, 2)).toEqual(saved);
    expect(out).toHaveLength(QUICK_TAPS.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(QUICK_TAPS)));
  });

  it('an empty saved order falls back to the schedule-aware default', () => {
    expect(ids(orderQuickTaps(QUICK_TAPS, [], 'closing'))[0]).toBe('closing_duties');
  });
});
