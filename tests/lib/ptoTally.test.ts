import { describe, it, expect } from 'vitest';
import { shiftTallyDelta, ownedTallyDelta } from '../../src/lib/ptoTally';

const YEAR = 2026;
const thisYear = (type: 'pto' | 'sick' | 'day-off' | 'opening' | 'closing') =>
  ({ shiftType: type, date: '2026-07-15' });
const nextYear = (type: 'pto' | 'sick') => ({ shiftType: type, date: '2027-07-15' });

describe('shiftTallyDelta — create (null → after)', () => {
  it('counts a new PTO day this year', () => {
    expect(shiftTallyDelta(null, thisYear('pto'), YEAR)).toEqual({ pto: 1, sick: 0 });
  });
  it('counts a new sick day this year', () => {
    expect(shiftTallyDelta(null, thisYear('sick'), YEAR)).toEqual({ pto: 0, sick: 1 });
  });
  it('ignores a PTO day dated in a different year', () => {
    expect(shiftTallyDelta(null, nextYear('pto'), YEAR)).toEqual({ pto: 0, sick: 0 });
  });
  it('ignores a non-PTO / non-sick shift', () => {
    expect(shiftTallyDelta(null, thisYear('opening'), YEAR)).toEqual({ pto: 0, sick: 0 });
  });
});

describe('shiftTallyDelta — delete (before → null)', () => {
  it('decrements when a PTO day is removed', () => {
    expect(shiftTallyDelta(thisYear('pto'), null, YEAR)).toEqual({ pto: -1, sick: 0 });
  });
  it('decrements when a sick day is removed', () => {
    expect(shiftTallyDelta(thisYear('sick'), null, YEAR)).toEqual({ pto: 0, sick: -1 });
  });
  it('ignores removing a day-off', () => {
    expect(shiftTallyDelta(thisYear('day-off'), null, YEAR)).toEqual({ pto: 0, sick: 0 });
  });
});

describe('shiftTallyDelta — edit / flip (before → after)', () => {
  it('flips day-off → PTO (Aaron’s case)', () => {
    expect(shiftTallyDelta(thisYear('day-off'), thisYear('pto'), YEAR)).toEqual({ pto: 1, sick: 0 });
  });
  it('flips PTO → day-off', () => {
    expect(shiftTallyDelta(thisYear('pto'), thisYear('day-off'), YEAR)).toEqual({ pto: -1, sick: 0 });
  });
  it('flips PTO → sick (one down, one up)', () => {
    expect(shiftTallyDelta(thisYear('pto'), thisYear('sick'), YEAR)).toEqual({ pto: -1, sick: 1 });
  });
  it('is a no-op for a notes-only edit (PTO → PTO)', () => {
    expect(shiftTallyDelta(thisYear('pto'), thisYear('pto'), YEAR)).toEqual({ pto: 0, sick: 0 });
  });
  it('is a no-op flipping between two scheduled shift types', () => {
    expect(shiftTallyDelta(thisYear('opening'), thisYear('closing'), YEAR)).toEqual({ pto: 0, sick: 0 });
  });
});

describe('shiftTallyDelta — date moves across the year boundary', () => {
  it('decrements when a PTO day is moved out of the counted year', () => {
    expect(shiftTallyDelta(thisYear('pto'), nextYear('pto'), YEAR)).toEqual({ pto: -1, sick: 0 });
  });
  it('increments when a PTO day is moved into the counted year', () => {
    expect(shiftTallyDelta(nextYear('pto'), thisYear('pto'), YEAR)).toEqual({ pto: 1, sick: 0 });
  });
});

describe('ownedTallyDelta — personal tally is scoped to the viewer', () => {
  const ME = 'user-me';
  const TEAMMATE = 'user-teammate';

  it('applies the delta when the shift belongs to the viewer', () => {
    expect(ownedTallyDelta(ME, ME, thisYear('day-off'), thisYear('pto'), YEAR))
      .toEqual({ pto: 1, sick: 0 });
  });
  it('zeroes the delta when a manager edits a teammate’s shift', () => {
    // A manager flipping a teammate’s day-off → PTO must not drift the manager’s
    // own tally — the mount query that seeds it is scoped to the viewer’s id.
    expect(ownedTallyDelta(TEAMMATE, ME, thisYear('day-off'), thisYear('pto'), YEAR))
      .toEqual({ pto: 0, sick: 0 });
  });
  it('zeroes the delta for deleting a teammate’s PTO day', () => {
    expect(ownedTallyDelta(TEAMMATE, ME, thisYear('pto'), null, YEAR))
      .toEqual({ pto: 0, sick: 0 });
  });
  it('zeroes the delta when there is no logged-in viewer', () => {
    expect(ownedTallyDelta(ME, undefined, null, thisYear('pto'), YEAR))
      .toEqual({ pto: 0, sick: 0 });
  });
  it('still respects the year scope for the viewer’s own shift', () => {
    expect(ownedTallyDelta(ME, ME, null, nextYear('pto'), YEAR))
      .toEqual({ pto: 0, sick: 0 });
  });
});
