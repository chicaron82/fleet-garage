import { describe, it, expect } from 'vitest';
import { projectFleetBalance, dayOfWeek, PROJECTION_WINDOW, type BalanceEntry } from '../../src/lib/fleetProjection';

// 2026-09-01 is a Tuesday; 2026-09-05 a Saturday.
const e = (date: string, outCount: number, inCount = outCount): BalanceEntry => ({ date, outCount, inCount });

/** Eight consecutive Tuesdays, oldest first, climbing — the real shape: the fleet grew. */
const TUESDAYS: BalanceEntry[] = [
  e('2026-07-07', 10), e('2026-07-14', 20), e('2026-07-21', 30), e('2026-07-28', 40),
  e('2026-08-04', 90), e('2026-08-11', 100), e('2026-08-18', 110), e('2026-08-25', 120),
];

describe('dayOfWeek', () => {
  it('matches JS getDay(): Sunday 0 … Saturday 6', () => {
    expect(dayOfWeek('2026-09-06')).toBe(0);  // Sun
    expect(dayOfWeek('2026-09-08')).toBe(2);  // Tue
    expect(dayOfWeek('2026-09-12')).toBe(6);  // Sat
  });
});

describe('projectFleetBalance — the window', () => {
  it('⭐⭐ averages only the LAST 4 same-weekdays, not every one ever recorded', () => {
    const p = projectFleetBalance('2026-09-01', TUESDAYS);
    // last 4 = 90,100,110,120 → 105.  All-time would be 65 — the old rule, 40 cars low.
    expect(p?.avgOut).toBe(105);
    expect(PROJECTION_WINDOW).toBe(4);
  });

  it('⚠️ the OLD all-time mean is what this replaces — proof the window is doing the work', () => {
    const allTime = Math.round(TUESDAYS.reduce((s, t) => s + t.outCount, 0) / TUESDAYS.length);
    expect(allTime).toBe(65);
    expect(projectFleetBalance('2026-09-01', TUESDAYS)?.avgOut).not.toBe(allTime);
  });

  it('uses everything it has when there are fewer than 4 same-weekdays', () => {
    const two = TUESDAYS.slice(0, 2);                 // 10, 20
    const p = projectFleetBalance('2026-09-01', two);
    expect(p?.avgOut).toBe(15);
    expect(p?.label).toBe('Based on the last 2 Tuesdays');
  });

  it('⚠️ a label must not claim a window it does not have', () => {
    const p = projectFleetBalance('2026-09-01', TUESDAYS);
    expect(p?.label).toBe('Based on the last 4 Tuesdays');
    expect(p?.basis).toBe('same-weekday Tuesday n=4');
  });
});

describe('projectFleetBalance — the other two tiers', () => {
  it('a weekend leans on the last 7 DAYS, not the last Saturdays', () => {
    const week = [
      e('2026-08-30', 1), e('2026-08-31', 2), e('2026-09-01', 3), e('2026-09-02', 4),
      e('2026-09-03', 5), e('2026-09-04', 6), e('2026-09-05', 7), e('2026-09-06', 800),
    ];
    const p = projectFleetBalance('2026-09-12', week);   // Saturday
    expect(p?.basis).toBe('prior-7 n=7');
    // The oldest entry falls out of the tail slice; the newest (800) is in it.
    expect(p?.avgOut).toBe(Math.round((2 + 3 + 4 + 5 + 6 + 7 + 800) / 7));
  });

  it('⚠️ the weekday fallback is capped too — it had the same unbounded flaw', () => {
    // A Wednesday with no Wednesday history, so it falls back to weekdays generally.
    const mixed = [
      e('2026-08-03', 10), e('2026-08-04', 10), e('2026-08-06', 10), e('2026-08-07', 10),
      e('2026-08-10', 90), e('2026-08-11', 90), e('2026-08-13', 90), e('2026-08-14', 90),
    ];
    const p = projectFleetBalance('2026-09-02', mixed);  // Wednesday
    expect(p?.basis).toBe('weekday-fallback n=4');
    expect(p?.avgOut).toBe(90);                          // not 50, which the all-time mean gives
  });
});

describe('projectFleetBalance — refusing to answer', () => {
  it('returns null rather than a number it cannot support', () => {
    expect(projectFleetBalance('2026-09-01', [])).toBeNull();
    expect(projectFleetBalance('2026-09-01', [e('2026-08-25', 100)])).toBeNull();
    expect(projectFleetBalance('2026-09-12', [e('2026-09-11', 100)])).toBeNull();
  });

  it('⚠️ null is a real answer, never a zero', () => {
    expect(projectFleetBalance('2026-09-01', [])).not.toEqual({ avgOut: 0, avgIn: 0 });
  });
});
