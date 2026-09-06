import { describe, it, expect } from 'vitest';
import { rankTimePresets, presetsWorthShowing } from '../../src/lib/shiftTimePresets';
import type { ShiftTimeRow } from '../../src/lib/shiftTimePresets';

const row = (shiftType: string, start: string, end: string): ShiftTimeRow => ({ shiftType, start, end });
/** n copies, because the ranking is a tally and the tests are about counts. */
const many = (n: number, t: string, s: string, e: string) => Array.from({ length: n }, () => row(t, s, e));

describe('rankTimePresets', () => {
  it('ranks by how often a window is actually scheduled', () => {
    const rows = [...many(52, 'mid', '10:00', '18:30'), ...many(40, 'mid', '10:30', '19:00'),
                  ...many(17, 'mid', '09:30', '18:00')];
    expect(rankTimePresets(rows, 'mid').map(p => `${p.start}-${p.end}`))
      .toEqual(['10:00-18:30', '10:30-19:00', '09:30-18:00']);
  });

  it('keeps the counts, because the number is the reason to trust the order', () => {
    const rows = [...many(5, 'mid', '10:00', '18:30'), ...many(3, 'mid', '09:30', '18:00')];
    expect(rankTimePresets(rows, 'mid').map(p => p.count)).toEqual([5, 3]);
  });

  it('only counts the type asked for', () => {
    const rows = [...many(9, 'closing', '14:30', '23:00'), ...many(4, 'mid', '09:30', '18:00')];
    expect(rankTimePresets(rows, 'mid')).toHaveLength(1);
    expect(rankTimePresets(rows, 'mid')[0].start).toBe('09:30');
  });

  it("drops one-offs — somebody's single odd window is noise in a chip row", () => {
    const rows = [...many(9, 'mid', '10:00', '18:30'), row('mid', '14:30', '22:00')];
    expect(rankTimePresets(rows, 'mid')).toHaveLength(1);
  });

  it('drops rows with no window rather than defaulting them — a day-off has no times', () => {
    // ⚠️ Inventing a window for these would put a phantom chip in the list.
    const rows = [...many(4, 'mid', '09:30', '18:00'), ...many(9, 'mid', '', '')];
    expect(rankTimePresets(rows, 'mid')).toEqual([{ start: '09:30', end: '18:00', count: 4 }]);
  });

  it('caps the row so he picks rather than scans', () => {
    const rows = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']
      .flatMap((s, i) => many(20 - i, 'mid', s, '18:00'));
    expect(rankTimePresets(rows, 'mid')).toHaveLength(4);
  });

  it('breaks ties on start time, so the row does not reshuffle under his thumb', () => {
    const rows = [...many(6, 'mid', '11:00', '19:30'), ...many(6, 'mid', '09:00', '17:30')];
    expect(rankTimePresets(rows, 'mid').map(p => p.start)).toEqual(['09:00', '11:00']);
  });

  it('returns nothing rather than throwing when there is no history at all', () => {
    expect(rankTimePresets([], 'mid')).toEqual([]);
  });
});

describe('presetsWorthShowing', () => {
  const p = (start: string, end: string, count = 9) => ({ start, end, count });

  it('hides a single chip — one option is not a choice', () => {
    expect(presetsWorthShowing([p('10:30', '19:00')], { start: '10:30', end: '19:00' })).toBe(false);
  });

  it('hides when every chip is the time already in the fields', () => {
    expect(presetsWorthShowing([p('10:30', '19:00'), p('10:30', '19:00')], { start: '10:30', end: '19:00' }))
      .toBe(false);
  });

  it('shows when there is somewhere else to go', () => {
    expect(presetsWorthShowing([p('10:30', '19:00'), p('09:30', '18:00')], { start: '10:30', end: '19:00' }))
      .toBe(true);
  });
});
