import { describe, it, expect } from 'vitest';
import {
  countTouched, resolveNumerator, BASIS_LABEL, BASIS_HINT, type TouchRow,
} from '../../src/lib/throughputBasis';

const HIM = 'aaron';
const HER = 'someone-else';

// His 2026-09-11 opening, the shift the ticket was measured against.
const START = '2026-09-11T11:45:00Z';   // 06:45 CDT
const END   = '2026-09-11T20:15:00Z';   // 15:15 CDT

const row = (vehicleId: string, changedAt: string, actor: string | null = HIM): TouchRow =>
  ({ vehicleId, actor, changedAt });

describe('countTouched', () => {
  it('⭐ counts DISTINCT vehicles, not rows — a car touched four times is one car', () => {
    const rows = [
      row('a', '2026-09-11T13:00:00Z'), row('a', '2026-09-11T13:05:00Z'),
      row('a', '2026-09-11T13:10:00Z'), row('b', '2026-09-11T14:00:00Z'),
    ];
    const c = countTouched(rows, HIM, START, END);
    expect(c.distinct).toBe(2);
    expect(c.rows).toBe(4);
  });

  it('⚠️⚠️ never counts another actor, even inside the window', () => {
    // The real trap: a second actor wrote 4 changes at 18:41 on the very day this was measured.
    const rows = [row('a', '2026-09-11T13:00:00Z'), row('b', '2026-09-11T13:30:00Z', HER)];
    const c = countTouched(rows, HIM, START, END);
    expect(c.distinct).toBe(1);
    expect(c.otherActors).toBe(1);
  });

  it('⚠️ a null actor is never his — rows predating the actor column must not inflate him', () => {
    const rows = [row('a', '2026-09-11T13:00:00Z', null), row('b', '2026-09-11T13:30:00Z')];
    const c = countTouched(rows, HIM, START, END);
    expect(c.distinct).toBe(1);
    expect(c.otherActors).toBe(0);   // unattributed is not "someone else" either
  });

  it('⭐ his work outside the window is SURFACED, not silently dropped', () => {
    // His asterisk: gas-sheet odometer entered after the shift still happened, it just isn't his shift.
    const rows = [
      row('a', '2026-09-11T13:00:00Z'),
      row('b', '2026-09-11T23:41:00Z'),   // 18:41 CDT — after an opening
      row('c', '2026-09-11T10:00:00Z'),   // before he clocked in
    ];
    const c = countTouched(rows, HIM, START, END);
    expect(c.distinct).toBe(1);
    expect(c.outsideWindow).toBe(2);
  });

  it('counts the window boundaries inclusively', () => {
    const c = countTouched([row('a', START), row('b', END)], HIM, START, END);
    expect(c.distinct).toBe(2);
    expect(c.outsideWindow).toBe(0);
  });

  it('ignores an unparseable timestamp rather than counting it as epoch', () => {
    const c = countTouched([row('a', 'not-a-date'), row('b', '2026-09-11T13:00:00Z')], HIM, START, END);
    expect(c.distinct).toBe(1);
  });

  it('an empty log is zero, not a crash', () => {
    expect(countTouched([], HIM, START, END)).toEqual({ distinct: 0, rows: 0, outsideWindow: 0, otherActors: 0 });
  });

  it('⭐ reproduces the shape of the real shift: 88 rows → 54 distinct', () => {
    // 54 cars, the last 34 of them touched twice — 88 rows, which is what the live query returned.
    const rows: TouchRow[] = [];
    for (let i = 0; i < 54; i++) rows.push(row(`v${i}`, '2026-09-11T13:00:00Z'));
    for (let i = 20; i < 54; i++) rows.push(row(`v${i}`, '2026-09-11T14:00:00Z'));
    const c = countTouched(rows, HIM, START, END);
    expect(c.rows).toBe(88);
    expect(c.distinct).toBe(54);
  });
});

describe('resolveNumerator', () => {
  it('gas-sheet basis returns the partitioned day figure untouched', () => {
    expect(resolveNumerator('gas-sheet', 57, null)).toBe(57);
  });

  it('cars-touched basis returns the distinct count', () => {
    const touched = { distinct: 54, rows: 88, outsideWindow: 0, otherActors: 0 };
    expect(resolveNumerator('cars-touched', 57, touched)).toBe(54);
  });

  it('⚠️ returns NULL while the count is still loading — never 0', () => {
    // A zero here reads as "you did nothing today", which the card would say on every page load.
    expect(resolveNumerator('cars-touched', 57, null)).toBeNull();
  });

  it('passes a null gas-sheet figure through unchanged', () => {
    expect(resolveNumerator('gas-sheet', null, null)).toBeNull();
  });
});

describe('labels', () => {
  it('⭐ the two bases are never ambiguous about which question they answer', () => {
    expect(BASIS_LABEL['gas-sheet']).not.toBe(BASIS_LABEL['cars-touched']);
    expect(BASIS_HINT['gas-sheet']).toMatch(/bay/i);
    expect(BASIS_HINT['cars-touched']).toMatch(/you/i);
  });
});
