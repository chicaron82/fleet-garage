import { describe, it, expect } from 'vitest';
import { projectFleetBalance, dayOfWeek, PROJECTION_WINDOW, RECENT_ANCHOR, WEEKDAY_WEIGHT, type BalanceEntry } from '../../src/lib/fleetProjection';

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
    // weekday half: last 4 Tuesdays = 90,100,110,120 → 105.  All-time would be 65 — the old rule,
    // 40 cars low.  The level anchor (last 5 entries = 92) then pulls it to (105 + 92) / 2 = 98.5.
    expect(p?.avgOut).toBe(99);
    expect(PROJECTION_WINDOW).toBe(4);
  });

  it('⚠️ the OLD all-time mean is what this replaces — proof the window is doing the work', () => {
    const allTime = Math.round(TUESDAYS.reduce((s, t) => s + t.outCount, 0) / TUESDAYS.length);
    expect(allTime).toBe(65);
    expect(projectFleetBalance('2026-09-01', TUESDAYS)?.avgOut).not.toBe(allTime);
  });

  it('uses everything it has when there are fewer than 4 same-weekdays', () => {
    const two = TUESDAYS.slice(0, 2);                 // 10, 20 — and the anchor sees the same two
    const p = projectFleetBalance('2026-09-01', two);
    expect(p?.avgOut).toBe(15);
    expect(p?.label).toBe('Half the last 2 Tuesdays, half the last 2 days');
  });

  it('⚠️ a label must not claim a window it does not have — and a BLEND must read as a blend', () => {
    const p = projectFleetBalance('2026-09-01', TUESDAYS);
    expect(p?.label).toBe('Half the last 4 Tuesdays, half the last 5 days');
    expect(p?.basis).toBe('blend0.5 same-weekday Tuesday n=4 + prior-5 n=5');
  });
});

// ⭐⭐ WHY THESE EXIST (2026-09-17, `ticket-fleet-projection-anchor.md`). The last-4 window fixed the
// staleness of an all-time mean but kept a smaller version of it: four same-weekdays reach FOUR
// WEEKS back, so the estimate still carried last month's idea of how big a day is — a standing −3.6
// on OUT across 87 replayed days. The weekday half says what KIND of day it is; the recent half says
// what SIZE days are now. Replayed on this code: OUT mae 18.5 → 16.9, IN 15.3 → 14.4.
describe('projectFleetBalance — the level anchor', () => {
  it('⭐⭐⭐ a stale-high weekday average gets pulled toward the week that actually just happened', () => {
    const staleHigh: BalanceEntry[] = [
      e('2026-08-04', 100), e('2026-08-11', 100), e('2026-08-18', 100), e('2026-08-25', 100), // Tuesdays
      e('2026-08-26', 50), e('2026-08-27', 50), e('2026-08-28', 50), e('2026-08-31', 50),     // this week
    ];
    const p = projectFleetBalance('2026-09-01', staleHigh);     // Tuesday
    // weekday half = 100 (what the OLD rule would have answered, alone).
    // anchor half   = last 5 entries = (100 + 50 + 50 + 50 + 50) / 5 = 60.
    expect(p?.avgOut).toBe(80);
    expect(p?.avgOut).not.toBe(100);
  });

  it('…and a stale-LOW one gets pulled up — the correction is not one-directional', () => {
    const staleLow: BalanceEntry[] = [
      e('2026-08-04', 50), e('2026-08-11', 50), e('2026-08-18', 50), e('2026-08-25', 50),
      e('2026-08-26', 100), e('2026-08-27', 100), e('2026-08-28', 100), e('2026-08-31', 100),
    ];
    const p = projectFleetBalance('2026-09-01', staleLow);
    // weekday half = 50; anchor = (50 + 100·4) / 5 = 90 → (50 + 90) / 2 = 70.
    expect(p?.avgOut).toBe(70);
  });

  it('OUT and IN are anchored independently — they move on different days', () => {
    const split: BalanceEntry[] = [
      { date: '2026-08-18', outCount: 100, inCount: 20 }, { date: '2026-08-25', outCount: 100, inCount: 20 },
      { date: '2026-08-26', outCount: 20,  inCount: 100 }, { date: '2026-08-27', outCount: 20, inCount: 100 },
      { date: '2026-08-28', outCount: 20,  inCount: 100 },
    ];
    const p = projectFleetBalance('2026-09-01', split);
    // OUT: weekday 100, anchor (100+100+20+20+20)/5 = 52 → (100 + 52)/2 = 76.
    // IN:  weekday  20, anchor ( 20+ 20+100+100+100)/5 = 68 → ( 20 + 68)/2 = 44.
    // ⭐ The two columns land in different places off the SAME five days — which is the point: a
    // heavy-out week and a heavy-in week are different weeks, and one anchor cannot serve both.
    expect(p?.avgOut).toBe(76);
    expect(p?.avgIn).toBe(44);
  });

  it('⚠️ rounds ONCE, at the end — not each half before combining', () => {
    const halves: BalanceEntry[] = [e('2026-08-18', 10), e('2026-08-25', 11), e('2026-08-26', 20)];
    const p = projectFleetBalance('2026-09-01', halves);        // Tuesday
    // weekday half = 10.5, anchor = 41/3 = 13.67 → 12.08 → 12.
    // Rounding each half FIRST gives 11 and 14 → 12.5 → 13. The off-by-one is the whole point.
    expect(p?.avgOut).toBe(12);
  });

  it('the constants are the measured ones — a silent re-tune should fail here', () => {
    expect(RECENT_ANCHOR).toBe(5);
    expect(WEEKDAY_WEIGHT).toBe(0.5);
  });

  // ⚠️ The weekend tier has no weekday component to re-anchor, and blending prior-7 with prior-5 is
  // a trailing average wearing a costume. It was deliberately left alone; this pins that.
  it('⚠️ weekends are NOT blended — that tier is untouched', () => {
    const week = [
      e('2026-08-30', 1), e('2026-08-31', 2), e('2026-09-01', 3), e('2026-09-02', 4),
      e('2026-09-03', 5), e('2026-09-04', 6), e('2026-09-05', 7),
    ];
    const p = projectFleetBalance('2026-09-12', week);          // Saturday
    expect(p?.basis).toBe('prior-7 n=7');
    expect(p?.basis).not.toContain('blend');
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
