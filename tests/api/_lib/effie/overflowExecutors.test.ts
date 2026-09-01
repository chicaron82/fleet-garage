import { describe, it, expect } from 'vitest';
import { groupOverflowSends, resolveSentScope, type SentRow } from '../../../../api/_lib/effie/overflowExecutors';

// Aaron, 2026-09-01, heading to a mid shift:
//   "they display day of. but what if I want to know what was sent where later. like today.
//    what was sent there yesterday."
//
// The data was always there — every overflow send is a permanent vsa_trips row. What was missing
// was a question shaped like his. And the ONLY answer available, scope "current", would have come
// back looking right: a where-is-everything-NOW list, offered as a what-happened-YESTERDAY list.

// Winnipeg is UTC-5 in summer, and the shift day rolls over at the cutover hour — so these ISO
// stamps are chosen to land unambiguously mid-afternoon local.
const at = (iso: string, dest: string, unit: string): SentRow => ({
  vehicle_unit: unit, vehicle_plate: null, arrive_location: dest, depart_time: iso,
});

// Newest-first, the order the query returns.
const ROWS: SentRow[] = [
  at('2026-09-01T18:20:00Z', 'FastAir',   '5424932'),  // today  — moved here from AV Flight
  at('2026-08-31T20:10:00Z', 'AV Flight', '5424932'),  // YESTERDAY
  at('2026-08-31T19:00:00Z', 'FastAir',   '5411008'),  // yesterday, second send of the day
  at('2026-08-31T16:30:00Z', 'AV Flight', '5411008'),  // yesterday, first send
  at('2026-08-25T17:00:00Z', 'FastAir',   '5400111'),  // last week, never moved since
];

describe('groupOverflowSends — "current": where is everything NOW', () => {
  it('reports each vehicle once, at its newest spot', () => {
    const out = groupOverflowSends(ROWS, 'current');
    expect(out.scope).toBe('current');
    expect(out.total).toBe(3);
    const fastair = out.groups.find(g => g.destination === 'FastAir')!;
    // 5424932 moved to FastAir today; 5411008's newest is FastAir; 5400111 never moved.
    expect(fastair.vehicles.sort()).toEqual(['5400111', '5411008', '5424932']);
    expect(out.groups.find(g => g.destination === 'AV Flight')).toBeUndefined();
  });

  it('carries no date — it is a position, not a day', () => {
    expect(groupOverflowSends(ROWS, 'current').date).toBeUndefined();
  });
});

describe('groupOverflowSends — "day": what was SENT that day', () => {
  const day = groupOverflowSends(ROWS, 'day', '2026-08-31');

  // ⭐ THE WHOLE POINT. Under "current" this car reads as FastAir, because it was moved today.
  // Yesterday it went to AV Flight, and that is still true.
  it('keeps a car that has since been moved somewhere else', () => {
    const av = day.groups.find(g => g.destination === 'AV Flight')!;
    expect(av.vehicles.some(v => v.startsWith('5424932'))).toBe(true);
  });

  it('does NOT dedup — two sends in one day are two moves', () => {
    const all = day.groups.flatMap(g => g.vehicles);
    expect(all.filter(v => v.startsWith('5411008'))).toHaveLength(2);
    expect(day.total).toBe(3);
  });

  it('puts a TIME on every row, so two moves do not read as a duplicated line', () => {
    for (const v of day.groups.flatMap(g => g.vehicles)) expect(v).toMatch(/ · \d{2}:\d{2}$/);
  });

  it('names the date it answered for — a report that does not say its day is not an answer', () => {
    expect(day.date).toBe('2026-08-31');
    expect(day.scope).toBe('day');
  });

  it('excludes other days entirely', () => {
    const all = day.groups.flatMap(g => g.vehicles);
    expect(all.some(v => v.startsWith('5400111'))).toBe(false);  // last week
  });

  it('is empty, not wrong, for a day with no sends', () => {
    const quiet = groupOverflowSends(ROWS, 'day', '2026-08-30');
    expect(quiet).toMatchObject({ scope: 'day', date: '2026-08-30', total: 0, groups: [] });
  });
});

describe('resolveSentScope — which question was actually asked', () => {
  const now = new Date('2026-09-01T18:00:00Z');

  it('a date always means that day, whatever the scope says', () => {
    // The caller is a language model; a scope/date pair that disagree must still be answered
    // honestly rather than silently resolved to the wrong one.
    expect(resolveSentScope(ROWS, { scope: 'current', date: '2026-08-31' }, now).date).toBe('2026-08-31');
  });

  it('"shift" with no date means today — the end-of-shift report', () => {
    expect(resolveSentScope(ROWS, { scope: 'shift' }, now)).toMatchObject({ scope: 'day', date: '2026-09-01' });
  });

  it('"day" with no date also means today', () => {
    expect(resolveSentScope(ROWS, { scope: 'day' }, now).date).toBe('2026-09-01');
  });

  it('defaults to current when nothing is asked for', () => {
    expect(resolveSentScope(ROWS, {}, now).scope).toBe('current');
  });

  it('ignores a blank date rather than treating it as a day', () => {
    expect(resolveSentScope(ROWS, { date: '   ' }, now).scope).toBe('current');
  });

  // ⚠️ The shift day rolls over at CUTOVER_HOUR, so a late-night send belongs to the shift that
  // started the evening before. A calendar-day filter would file it under the wrong day.
  it('files an AFTER-MIDNIGHT send under the shift day it belongs to, not the calendar day', () => {
    // 07:30Z = 02:30 local on Sep 1, which is BEFORE the 04:00 cutover — so it belongs to the
    // shift day that began Aug 31. ⚠️ The times here are chosen to actually discriminate: a
    // plain calendar-day filter would file this under Sep 1 and this test would fail. A 23:30
    // stamp would have passed under either rule and proved nothing.
    const afterMidnight: SentRow[] = [at('2026-09-01T07:30:00Z', 'FastAir', '5499999')];
    expect(groupOverflowSends(afterMidnight, 'day', '2026-08-31').total).toBe(1);
    expect(groupOverflowSends(afterMidnight, 'day', '2026-09-01').total).toBe(0);
  });
});
