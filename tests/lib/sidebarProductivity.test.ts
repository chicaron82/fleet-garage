import { describe, it, expect } from 'vitest';
import {
  resolveActiveLog, deriveVsaProductivity, deriveDriverWeek,
  type PrimaryLog, type BackfillLog,
} from '../../src/lib/sidebarProductivity';
import type { HandoffNote } from '../../src/types';

// Behaviour-locking net for the sidebar productivity math, extracted verbatim
// from useSidebar — this block was the repeated landing zone of the washbay
// date-semantics fixes and had zero direct coverage while it lived in the hook.

// Daytime anchor — well clear of the 04:00 shift cutover.
const NOW = new Date('2026-06-12T15:00:00');

function log(over: Partial<PrimaryLog> = {}): PrimaryLog {
  // 2 full pages + 12 = 50 cars in; 10 remaining → 40 cleaned; no OT → 15h.
  return { date: '2026-06-12', fullPages: 2, lastPageEntries: 12, carsRemaining: 10, overtimeHours: 0, ...over };
}

function handoff(over: Partial<HandoffNote> = {}): HandoffNote {
  // Morning crew: 1 page + 5 = 24 cleaned by handoff, logged 11:30 → boundary on the 12th.
  return {
    id: 'h-1', branchId: 'YWG', loggedById: 'u-1', loggedByName: 'Opener',
    loggedAt: '2026-06-12T11:30:00', fullPages: 1, lastPageEntries: 5,
    teamSize: 3, lotStatus: 'manageable' as HandoffNote['lotStatus'],
    morningHours: 8.0, carryOverCleared: 0, ...over,
  };
}

describe('resolveActiveLog', () => {
  const backfill: BackfillLog = { date: '2026-06-11', full_pages: 1, last_page_entries: 0, cars_remaining: 2, overtime_hours: 0 };

  it('newest wins between the latest real close and the latest backfill', () => {
    expect(resolveActiveLog([log({ date: '2026-06-12' })], backfill)).toMatchObject({ date: '2026-06-12' });
    expect(resolveActiveLog([log({ date: '2026-06-10' })], backfill)).toBe(backfill);
  });

  it('carry-over-only closes (zero gas-sheet counters) never drive the readout', () => {
    const carryOnly = log({ date: '2026-06-12', fullPages: 0, lastPageEntries: 0 });
    expect(resolveActiveLog([carryOnly, log({ date: '2026-06-10' })], null)).toMatchObject({ date: '2026-06-10' });
  });

  it('null when there is nothing at all', () => {
    expect(resolveActiveLog([], null)).toBeNull();
  });
});

describe('deriveVsaProductivity', () => {
  const base = {
    offStandardEntries: [], todayHandoff: null, shiftCheckpoints: [],
    userShiftType: null, isPeakSeason: false, washbayLogs: [], now: NOW,
  };

  it('daily rate = cleaned / (15 + OT) when no OTH logged', () => {
    const r = deriveVsaProductivity({ ...base, activeLog: log() });
    expect(r.dailyRate).toBe(Math.round((40 / 15) * 10) / 10); // 2.7
    expect(r.recentLabel).toBe('Earlier today');
  });

  it('OTH shrinks the denominator (adjusted hours, floored at 0.1)', () => {
    const r = deriveVsaProductivity({
      ...base, activeLog: log(),
      offStandardEntries: [{ minutes: 90, startTime: '2026-06-12T13:00:00' }],
    });
    expect(r.dailyRate).toBe(Math.round((40 / 13.5) * 10) / 10); // 3.0
  });

  it('peak season fixes the window at 16h and ignores overtime', () => {
    const r = deriveVsaProductivity({ ...base, activeLog: log({ overtimeHours: 2 }), isPeakSeason: true });
    expect(r.dailyRate).toBe(Math.round((40 / 16) * 10) / 10); // 2.5
  });

  it('reads a snake_case backfill row identically to a camelCase close', () => {
    const backfill: BackfillLog = { date: '2026-06-12', full_pages: 2, last_page_entries: 12, cars_remaining: 10, overtime_hours: 0 };
    const r = deriveVsaProductivity({ ...base, activeLog: backfill });
    expect(r.dailyRate).toBe(Math.round((40 / 15) * 10) / 10);
  });

  it('splits morning/closing off the handoff and resolves the headline by shift type', () => {
    const r = deriveVsaProductivity({
      ...base, activeLog: log(), todayHandoff: handoff(), userShiftType: 'closing',
    });
    // Morning: 24 cleaned / 8h = 3.0; closing: (40 − 24) / 8h = 2.0.
    expect(r.morningRate).toBe(3);
    expect(r.closingRate).toBe(2);
    expect(r.hasSplit).toBe(true);
    expect(r.resolvedRate).toBe(2);
    expect(r.resolvedShiftIcon).toBe('🌙');
  });

  it('the closing-arrival checkpoint beats the handoff as the closing start-count', () => {
    const r = deriveVsaProductivity({
      ...base, activeLog: log(), todayHandoff: handoff(), userShiftType: 'closing',
      shiftCheckpoints: [{ date: '2026-06-12', checkpointType: 'closing_arrival', fullPages: 1, lastPageEntries: 11 }],
    });
    // Checkpoint count 30 → closing cleaned = 40 − 30 = 10 → 10/8 = 1.3.
    expect(r.closingRate).toBe(1.3);
  });

  it('OTH lands on the correct side of the morning/closing boundary', () => {
    const r = deriveVsaProductivity({
      ...base, activeLog: log(), todayHandoff: handoff(), userShiftType: 'opening',
      offStandardEntries: [
        { minutes: 60, startTime: '2026-06-12T08:00:00' },  // morning side
        { minutes: 60, startTime: '2026-06-12T18:00:00' },  // closing side
      ],
    });
    // Morning: 24 / (8 − 1) = 3.4; closing: 16 / (8 − 1) = 2.3.
    expect(r.morningRate).toBe(3.4);
    expect(r.closingRate).toBe(2.3);
    expect(r.resolvedRate).toBe(3.4);
    expect(r.resolvedShiftIcon).toBe('☀️');
  });

  it('week average needs ≥3 real closes in the prior 7 shift-days, excluding today and carry-over-only rows', () => {
    const week = [
      log({ date: '2026-06-09' }), log({ date: '2026-06-10' }), log({ date: '2026-06-11' }),
      log({ date: '2026-06-12' }),                                  // today — excluded
      log({ date: '2026-06-08', fullPages: 0, lastPageEntries: 0 }), // carry-over-only — excluded
    ];
    const r = deriveVsaProductivity({ ...base, activeLog: log(), washbayLogs: week });
    expect(r.weekAvgRate).toBe(2.7); // three identical 40/15 days
    expect(r.delta).toBe(0);
    expect(r.deltaLabel).toBe('+0');

    const two = [log({ date: '2026-06-09' }), log({ date: '2026-06-10' })];
    expect(deriveVsaProductivity({ ...base, activeLog: log(), washbayLogs: two }).weekAvgRate).toBeNull();
  });

  it('labels yesterday and older dates correctly', () => {
    expect(deriveVsaProductivity({ ...base, activeLog: log({ date: '2026-06-11' }) }).recentLabel).toBe('Yesterday');
    expect(deriveVsaProductivity({ ...base, activeLog: log({ date: '2026-06-08' }) }).recentLabel).toBe('2026-06-08');
    expect(deriveVsaProductivity({ ...base, activeLog: null }).recentLabel).toBe('Last shift');
  });
});

describe('deriveDriverWeek', () => {
  it('buckets trips by business date — a post-midnight trip belongs to the prior shift-day', () => {
    const { tripsToday } = deriveDriverWeek([
      { depart_time: '2026-06-12T10:00:00' },
      { depart_time: '2026-06-13T01:30:00' }, // overnight: still the 12th's shift
      { depart_time: '2026-06-11T10:00:00' },
    ], NOW);
    expect(tripsToday).toBe(2);
  });

  it('week average needs ≥3 distinct days', () => {
    const trips = [
      { depart_time: '2026-06-09T10:00:00' }, { depart_time: '2026-06-09T11:00:00' },
      { depart_time: '2026-06-10T10:00:00' },
      { depart_time: '2026-06-11T10:00:00' }, { depart_time: '2026-06-11T12:00:00' }, { depart_time: '2026-06-11T14:00:00' },
    ];
    expect(deriveDriverWeek(trips, NOW).weekAvgTrips).toBe(2); // (2+1+3)/3
    expect(deriveDriverWeek(trips.slice(0, 3), NOW).weekAvgTrips).toBeNull();
  });
});
