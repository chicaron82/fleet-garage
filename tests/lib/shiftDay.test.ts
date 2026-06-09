import { describe, it, expect } from 'vitest';
import {
  SHIFT_DAY_CUTOVER_HOUR,
  shiftDateStr,
  businessDateOf,
  shiftDayWindow,
  shiftDayStartISO,
  shiftDaysSince,
} from '../../src/lib/shiftDay';

// Local-time constructor keeps these assertions timezone-independent: the
// helpers read/write local components, so building the instants the same way
// matches whatever zone the test runner sits in.
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi);

describe('shiftDateStr — the day rolls at 04:00, not midnight', () => {
  it('attributes a 12:36 AM entry to the previous calendar day', () => {
    expect(shiftDateStr(0, at(2026, 6, 2, 0, 36))).toBe('2026-06-01');
  });
  it('still counts the previous day at 03:59 AM', () => {
    expect(shiftDateStr(0, at(2026, 6, 2, 3, 59))).toBe('2026-06-01');
  });
  it('rolls to the new day exactly at the cutover hour', () => {
    expect(shiftDateStr(0, at(2026, 6, 2, SHIFT_DAY_CUTOVER_HOUR, 0))).toBe('2026-06-02');
  });
  it('is unremarkable during daytime', () => {
    expect(shiftDateStr(0, at(2026, 6, 1, 14, 0))).toBe('2026-06-01');
  });
  it('holds the same shift-date right up to 11:59 PM', () => {
    expect(shiftDateStr(0, at(2026, 6, 1, 23, 59))).toBe('2026-06-01');
  });
  it('offsetDays steps whole shift-days off the anchor', () => {
    // 2 AM on the 2nd is still the 1st's shift; -1 day from there is the 31st.
    expect(shiftDateStr(-1, at(2026, 6, 2, 2, 0))).toBe('2026-05-31');
  });
});

describe('businessDateOf — which shift-day a stored timestamp belongs to', () => {
  it('buckets a post-midnight timestamp into the prior shift-day', () => {
    expect(businessDateOf(at(2026, 6, 2, 0, 30))).toBe('2026-06-01');
  });
  it('buckets a morning timestamp into the current day', () => {
    expect(businessDateOf(at(2026, 6, 2, 9, 0))).toBe('2026-06-02');
  });
  it('accepts an ISO string', () => {
    expect(businessDateOf(at(2026, 6, 2, 1, 0).toISOString())).toBe('2026-06-01');
  });
});

describe('shiftDayWindow — cutover-to-cutover bracket', () => {
  it('spans exactly 24 hours', () => {
    const { startISO, endISO } = shiftDayWindow('2026-06-01');
    const span = new Date(endISO).getTime() - new Date(startISO).getTime();
    expect(span).toBe(24 * 60 * 60 * 1000);
  });
  it('starts and ends on the matching business dates', () => {
    const { startISO, endISO } = shiftDayWindow('2026-06-01');
    expect(businessDateOf(startISO)).toBe('2026-06-01');
    expect(businessDateOf(endISO)).toBe('2026-06-02');
  });
  it('contains a 12:36 AM next-calendar-day timestamp (the overtime case)', () => {
    const { startISO, endISO } = shiftDayWindow('2026-06-01');
    const lateNight = at(2026, 6, 2, 0, 36).getTime();
    expect(lateNight).toBeGreaterThanOrEqual(new Date(startISO).getTime());
    expect(lateNight).toBeLessThan(new Date(endISO).getTime());
  });
  it('excludes 03:59 AM of the start calendar date (it belongs to the prior shift)', () => {
    const { startISO } = shiftDayWindow('2026-06-01');
    expect(at(2026, 6, 1, 3, 59).getTime()).toBeLessThan(new Date(startISO).getTime());
  });
  it('shiftDayStartISO matches the window start', () => {
    expect(shiftDayStartISO('2026-06-01')).toBe(shiftDayWindow('2026-06-01').startISO);
  });
});

describe('shiftDaysSince — held-age counted in shift-days, not 24h spans', () => {
  it('is 0 for an item found earlier the same shift-day', () => {
    expect(shiftDaysSince(at(2026, 6, 1, 11, 5), at(2026, 6, 1, 16, 0))).toBe(0);
  });
  it('is 1 for an item found on the previous shift-day (the Today/Yesterday bug)', () => {
    // found yesterday 11:05, viewed today 09:37 — elapsed-ms math wrongly read 0.
    expect(shiftDaysSince(at(2026, 6, 1, 11, 5), at(2026, 6, 2, 9, 37))).toBe(1);
  });
  it('buckets a 00:00–04:00 found-time into the in-progress shift-day', () => {
    // found 02:00 on the 2nd is still the 1st's shift; viewed 03:00 same night, same shift → 0.
    expect(shiftDaysSince(at(2026, 6, 2, 2, 0), at(2026, 6, 2, 3, 0))).toBe(0);
  });
  it('advances at the cutover, not the 24-hour anniversary', () => {
    // found 23:00 on the 1st, viewed 05:00 on the 2nd — only ~6h elapsed but a
    // cutover boundary was crossed → 1.
    expect(shiftDaysSince(at(2026, 6, 1, 23, 0), at(2026, 6, 2, 5, 0))).toBe(1);
  });
  it('counts whole shift-days for older items', () => {
    expect(shiftDaysSince(at(2026, 6, 1, 12, 0), at(2026, 6, 17, 12, 0))).toBe(16);
  });
  it('accepts an ISO string', () => {
    expect(shiftDaysSince(at(2026, 6, 1, 11, 5).toISOString(), at(2026, 6, 2, 9, 37))).toBe(1);
  });
});
