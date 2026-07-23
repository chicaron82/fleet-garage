import { describe, it, expect } from 'vitest';
import { buildLiveDays, buildTodaySnapshot } from '../../src/components/washbay/shiftThroughputUtils';
import { buildRollingDates } from '../../src/components/washbay/washbay-history-utils';
import type { HandoffNote } from '../../src/types';

// The washbay throughput views resolve "which day" through shift-dates (04:00
// cutover). The bug these lock: when viewed/logged in the 00:00–04:00 overtime
// window, raw-calendar reckoning mis-aligned the washbay log, the handoff, and
// the checkpoint onto different days. A non-null morningRate is the signal that
// the handoff matched the day the builder was keyed to.

const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi);

function makeHandoff(loggedAt: string): HandoffNote {
  return {
    id: 'h1', branchId: 'YWG', loggedById: 'u1', loggedByName: 'Aaron',
    loggedAt, fullPages: 5, lastPageEntries: 0, teamSize: 2,
    lotStatus: 'manageable', morningHours: 8, carryOverCleared: 0, airportFlipping: false,
  };
}

describe('buildTodaySnapshot — keys on shift-day, not calendar', () => {
  it('matches the in-progress shift-day handoff in the 00:00–04:00 overtime window', () => {
    // 01:00 June 2 is still the June 1 shift; a handoff logged June 1 must count as "today".
    const now = at(2026, 6, 2, 1, 0);
    const handoff = makeHandoff(at(2026, 6, 1, 15, 15).toISOString());
    expect(buildTodaySnapshot([], [handoff], [], now).morningRate).not.toBeNull();
  });

  it('does not treat a fresh-calendar-day handoff as today during the overtime window', () => {
    // Same 01:00 June 2 — the shift is still June 1, so a June 2 handoff is a *future* shift.
    const now = at(2026, 6, 2, 1, 0);
    const handoff = makeHandoff(at(2026, 6, 2, 9, 0).toISOString());
    expect(buildTodaySnapshot([], [handoff], [], now).morningRate).toBeNull();
  });

  it('matches normally during the day', () => {
    const now = at(2026, 6, 1, 16, 0);
    const handoff = makeHandoff(at(2026, 6, 1, 9, 0).toISOString());
    expect(buildTodaySnapshot([], [handoff], [], now).morningRate).not.toBeNull();
  });
});

describe('buildLiveDays — each of the last 7 days keyed on its shift-date', () => {
  it('matches a handoff 7 shift-days back to the leading bucket', () => {
    const now = at(2026, 6, 8, 16, 0);
    const handoff = makeHandoff(at(2026, 6, 1, 9, 0).toISOString()); // 7 days back
    const days = buildLiveDays([], [handoff], [], now);
    expect(days).toHaveLength(7);
    expect(days[0].morningRate).not.toBeNull(); // i=7 → June 1
  });
});

describe('buildRollingDates — emits shift-dates', () => {
  it('leads with the in-progress shift-day during the overtime window', () => {
    const dates = buildRollingDates(at(2026, 6, 2, 1, 0)); // 01:00 June 2 = June 1 shift
    expect(dates[0]).toBe('2026-06-01');
    expect(dates[1]).toBe('2026-05-31');
  });

  it('leads with the calendar day during the day', () => {
    expect(buildRollingDates(at(2026, 6, 2, 14, 0))[0]).toBe('2026-06-02');
  });
});
