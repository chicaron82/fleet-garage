import { describe, it, expect } from 'vitest';
import { shiftTallyDelta } from '../../src/lib/ptoTally';

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
