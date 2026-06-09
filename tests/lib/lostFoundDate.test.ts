import { describe, it, expect } from 'vitest';
import { fmtRelativeDate, daysHeld, ageTier } from '../../src/lib/lostFoundDate';

// Local-time constructor — keeps assertions timezone-independent (the shift-day
// helpers underneath read local components).
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi);
const iso = (...a: Parameters<typeof at>) => at(...a).toISOString();

describe('fmtRelativeDate — shift-day relative label, verbatim time', () => {
  it('reads "Today" for an item found earlier the same shift-day', () => {
    expect(fmtRelativeDate(iso(2026, 6, 1, 11, 5), at(2026, 6, 1, 16, 0))).toMatch(/^Today /);
  });
  it('reads "Yesterday" for an item found on the previous shift-day (the bug)', () => {
    // Logged yesterday 11:05, viewed today 09:37 — used to read "Today · Day 0".
    expect(fmtRelativeDate(iso(2026, 6, 1, 11, 5), at(2026, 6, 2, 9, 37))).toMatch(/^Yesterday /);
  });
  it('falls back to a short date for older items', () => {
    const s = fmtRelativeDate(iso(2026, 6, 1, 11, 5), at(2026, 6, 5, 9, 0));
    expect(s).not.toMatch(/Today|Yesterday/);
  });
  it('keeps the time-of-day part', () => {
    expect(fmtRelativeDate(iso(2026, 6, 1, 11, 5), at(2026, 6, 1, 16, 0))).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('daysHeld — shift-day held counter', () => {
  it('counts shift-days, not 24h spans', () => {
    expect(daysHeld(iso(2026, 6, 1, 12, 0), at(2026, 6, 17, 12, 0))).toBe(16);
  });
  it('is 1 for a previous-shift-day find viewed after the cutover', () => {
    expect(daysHeld(iso(2026, 6, 1, 23, 0), at(2026, 6, 2, 5, 0))).toBe(1);
  });
});

describe('ageTier — escalation flips at the 15 / 30 marks', () => {
  it('returned items have no tier', () => {
    expect(ageTier('returned', 40)).toBeNull();
  });
  it('fresh below 15', () => {
    expect(ageTier('holding', 14)).toBe('fresh');
  });
  it('aging at exactly 15', () => {
    expect(ageTier('holding', 15)).toBe('aging');
  });
  it('aging through 29', () => {
    expect(ageTier('customer_contacted', 29)).toBe('aging');
  });
  it('expired at exactly 30', () => {
    expect(ageTier('holding', 30)).toBe('expired');
  });
});
