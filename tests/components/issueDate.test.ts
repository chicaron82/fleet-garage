import { describe, it, expect } from 'vitest';
import { daysOpen } from '../../src/components/issue-log/issueDate';

const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi);
const iso = (...a: Parameters<typeof at>) => at(...a).toISOString();

describe('daysOpen', () => {
  it('reads "Today" for an issue reported earlier the same shift-day', () => {
    expect(daysOpen(iso(2026, 6, 1, 10, 0), at(2026, 6, 1, 18, 0))).toBe('Today');
  });

  it('counts whole shift-days, not 24h spans', () => {
    expect(daysOpen(iso(2026, 6, 1, 10, 0), at(2026, 6, 4, 9, 0))).toBe('Day 3');
  });

  it('advances at the cutover, not the 24-hour anniversary', () => {
    // Reported 23:00 June 1, viewed 05:00 June 2 — ~6h elapsed but a shift-day
    // boundary was crossed.
    expect(daysOpen(iso(2026, 6, 1, 23, 0), at(2026, 6, 2, 5, 0))).toBe('Day 1');
  });
});
