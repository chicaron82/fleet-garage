// Find a car in the bay log (src/lib/bayFind.ts, docs/ticket-bay-log-find-a-car.md). Aaron, 2026-11-10: *"MCN117 for
// instance. Can we search and then see the results of it's last appearances"*, and *"14 days on the read-only"*.
import { describe, it, expect } from 'vitest';
import { bayAppearances, daysBack, findKey, windowStart, READ_ONLY_DAYS } from '../../src/lib/bayFind';
import { clockOf } from '../../src/lib/lotBay';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (over: Partial<BayLogRow>): BayLogRow => ({
  id: 335, vehicle_id: 'v', plate: 'MCN117', unit_number: null, car: '2026 Volkswagen Taos · Green', odometer: null,
  started_at: '2026-11-09T20:43:27.000Z', exit: 'clean', exited_at: '2026-11-09T20:46:32.000Z', took_dirty: true,
  redo_of: null, shift_day: '2026-11-09', note: null, hold_id: null, ...over,
});

describe('findKey: only letters and digits reach the query', () => {
  it('case and spaces fall away', () => expect(findKey(' mcn 117 ')).toBe('MCN117'));
  it('⭐ anything that could reshape a PostgREST filter is dropped', () => expect(findKey('MC,N.1*1(7)')).toBe('MCN117'));
  it('fewer than three searches nothing', () => {
    expect(findKey('MC')).toBeNull();
    expect(findKey('M-C')).toBeNull();
    expect(findKey('MCN')).toBe('MCN');
  });
});

describe('the read-only window', () => {
  it('⭐ 14 shift-days, today included: Tue Nov 10 reaches back to Wed Oct 28', () => {
    expect(READ_ONLY_DAYS).toBe(14);
    expect(windowStart(14, new Date(2026, 10, 10, 13, 0))).toBe('2026-10-28');
  });
  it('before the 04:00 cutover it is still the previous shift-day', () => {
    expect(windowStart(1, new Date(2026, 10, 10, 2, 0))).toBe('2026-11-09');
  });
  it('days back across a month end', () => {
    expect(daysBack('2026-11-09', '2026-11-10')).toBe(1);
    expect(daysBack('2026-10-28', '2026-11-10')).toBe(13);
  });
});

describe('bayAppearances: how each line reads', () => {
  it('⭐ MCN117: yesterday, Clean at its exit time', () => {
    const [l] = bayAppearances([row({})], '2026-11-10');
    expect(l).toMatchObject({ plate: 'MCN117', dayLabel: 'Yesterday', back: 1, label: 'Clean', time: clockOf('2026-11-09T20:46:32.000Z'), sentUp: false });
  });
  it('newest first, with today and an older day named', () => {
    const ls = bayAppearances([
      row({ id: 1, shift_day: '2026-11-03', started_at: '2026-11-03T15:00:00.000Z', exited_at: '2026-11-03T15:05:00.000Z' }),
      row({ id: 2, shift_day: '2026-11-10', started_at: '2026-11-10T15:00:00.000Z', exited_at: '2026-11-10T15:05:00.000Z' }),
    ], '2026-11-10');
    expect(ls.map(l => l.id)).toEqual([2, 1]);
    expect(ls[0]!.dayLabel).toBe('Today');
    expect(ls[1]!.dayLabel).toMatch(/Nov\.? 3/);
  });
  it('a hold says which in FG and only "Held" on the read-only link; ✈ and a note ride along', () => {
    expect(bayAppearances([row({ exit: 'bhold' })], '2026-11-10')[0]!.label).toBe('B hold');
    expect(bayAppearances([row({ exit: 'bhold' })], '2026-11-10', { readOnly: true })[0]!.label).toBe('Held');
    expect(bayAppearances([row({ sent_up: true, note: 'keys in cupholder' })], '2026-11-10')[0]).toMatchObject({ sentUp: true, note: 'keys in cupholder' });
  });
  it('a car still in the bay has no exit time', () => {
    expect(bayAppearances([row({ exit: null, exited_at: null })], '2026-11-10')[0]).toMatchObject({ label: 'In the bay', time: null });
  });
});
