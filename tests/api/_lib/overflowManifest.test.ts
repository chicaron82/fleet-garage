import { describe, it, expect } from 'vitest';
import { groupOverflowDays, MANIFEST_COLUMNS, type SentRow } from '../../../api/_lib/overflowManifest';

// Aaron, 2026-09-11, on the first cut of the My Day card:
//   "Ahh I was thinking to show what was last sent there."
//
// The first build answered "what went out TODAY", which on a normal day is nothing — a blank card
// in the slot he had just cleared of noise. What he carries is *when did we last send, and what
// went*. So the card leads with the newest day that HAS something, and the days stack under it.

// Winnipeg is UTC-5 in September; these stamps land mid-afternoon local, clear of the 04:00 cutover.
const at = (iso: string, dest: string, plate: string): SentRow => ({
  vehicle_plate: plate, vehicle_unit: '5424932', arrive_location: dest, depart_time: iso,
});

const ROWS: SentRow[] = [
  at('2026-09-09T19:10:00Z', 'FastAir', 'LUR247'),    // Sep 9 — the newest day
  at('2026-09-09T20:40:00Z', 'FastAir', 'LJF399'),
  at('2026-09-08T17:05:00Z', 'AV Flight', 'LZM564'),  // Sep 8 — the other column
  at('2026-09-08T21:15:00Z', 'FastAir', 'MCM559'),
  // Nothing on Sep 7.
  at('2026-09-06T18:00:00Z', 'AV Flight', 'LUR310'),
];

describe('groupOverflowDays — what was last sent, and when', () => {
  it('puts the newest day first, so the card opens on the last send', () => {
    expect(groupOverflowDays(ROWS).map(d => d.date)).toEqual(['2026-09-09', '2026-09-08', '2026-09-06']);
  });

  it('skips days with no sends entirely — a quiet day is the gap, not a row', () => {
    expect(groupOverflowDays(ROWS).some(d => d.date === '2026-09-07')).toBe(false);
  });

  it('counts every send on the day', () => {
    expect(groupOverflowDays(ROWS)[0]).toMatchObject({ date: '2026-09-09', total: 2 });
  });
});

describe('the columns hold their places', () => {
  // ⭐ His sketch has two fixed headings side by side (`FastAir   AV Flight`). Both appear on every
  // day even when one is empty, so the eye lands in the same spot scanning down — and "nothing went
  // to AV Flight that day" is itself an answer, not an absence to be hidden.
  it('always shows both spots, in his reading order', () => {
    const sep9 = groupOverflowDays(ROWS)[0];
    expect(sep9.groups.map(g => g.destination)).toEqual([...MANIFEST_COLUMNS]);
  });

  it('gives the quiet spot a zero, not a missing column', () => {
    const av = groupOverflowDays(ROWS)[0].groups.find(g => g.destination === 'AV Flight')!;
    expect(av).toMatchObject({ count: 0, vehicles: [] });
  });

  it('keeps plate · time on the lines, the manifest labels unchanged', () => {
    const fastair = groupOverflowDays(ROWS)[0].groups.find(g => g.destination === 'FastAir')!;
    expect(fastair.vehicles).toEqual(['LUR247 · 14:10', 'LJF399 · 15:40']);
  });
});

// ⭐⭐ Aaron, 2026-09-11: *"Remove the airport ones, anything sent to Richardson doesn't count. It's
// sent to their lot so they have it and can keep track of it. Since it's sitting in an O or P stall
// available for rent. FastAir and AV Flight are different."*
//
// ⚠️ And it was never only redundant: `arrive_location: 'Airport'` is what the ORDINARY driver-trip
// flow writes for a shuttle run, so counting it made two May airport runs (KUR 261, LUR193) render
// on the card as overflow sends. A rentable car in an O stall is not parked away anywhere.
describe('the airport is not overflow', () => {
  it('drops an airport run entirely — not a column, not a day', () => {
    expect(groupOverflowDays([at('2026-09-09T19:10:00Z', 'Airport', 'LUR551')])).toEqual([]);
  });

  it('keeps the real sends on a day that also has an airport run', () => {
    const day = groupOverflowDays([
      at('2026-09-09T19:10:00Z', 'Airport', 'LUR551'),
      at('2026-09-09T16:57:00Z', 'FastAir', 'LUR571'),
    ])[0];
    expect(day.total).toBe(1);
    expect(day.groups.map(g => g.destination)).toEqual([...MANIFEST_COLUMNS]);
    expect(day.groups.find(g => g.destination === 'FastAir')!.vehicles).toEqual(['LUR571 · 11:57']);
  });
});

describe('a day is history, not a position', () => {
  // Same rule as `groupOverflowSends('day')`, inherited rather than re-implemented: two sends of one
  // car in a day are two moves, and a car moved later still went where it went that day.
  it('does not dedup a car sent twice in one day', () => {
    const twice = groupOverflowDays([
      at('2026-09-09T19:10:00Z', 'FastAir', 'LUR247'),
      at('2026-09-09T22:30:00Z', 'AV Flight', 'LUR247'),
    ])[0];
    expect(twice.total).toBe(2);
    expect(twice.groups.find(g => g.destination === 'FastAir')!.count).toBe(1);
    expect(twice.groups.find(g => g.destination === 'AV Flight')!.count).toBe(1);
  });
});

describe('nothing at all', () => {
  it('is an empty list, not a day with zeroes', () => {
    expect(groupOverflowDays([])).toEqual([]);
  });
});
