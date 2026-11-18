// A full plate or unit is the moment a filter search "looked a car up" (docs/ticket-recent-cars-everywhere-and-restore-
// from-find.md). Aaron, 2026-11-18: *"it doesn't show my last search. So I have to retype it"*.
import { describe, it, expect } from 'vitest';
import { exactCarId, archivedCarFor } from '../../src/lib/exactCarMatch';

const cars = [
  { id: 'a', licensePlate: 'LUR528', unitNumber: '5429451' },
  { id: 'b', licensePlate: '0GK487', unitNumber: '5411000' },
  { id: 'c', licensePlate: 'LUR357', unitNumber: null },
];

describe('exactCarId', () => {
  it('a whole plate names its car', () => {
    expect(exactCarId('LUR528', cars)).toBe('a');
  });
  it('a whole unit number names its car', () => {
    expect(exactCarId('5429451', cars)).toBe('a');
  });
  it('⭐ a half-typed search names nothing, so it never lands in his recents', () => {
    expect(exactCarId('LUR5', cars)).toBeNull();
    expect(exactCarId('LUR52', cars)).toBeNull();
  });
  it('case, spaces and O-for-0 are forgiven, the way FG reads every typed plate', () => {
    expect(exactCarId('lur 528', cars)).toBe('a');
    expect(exactCarId('OGK487', cars)).toBe('b');
  });
  it('two cars on one key is not an answer: FG never picks between them', () => {
    expect(exactCarId('LUR528', [...cars, { id: 'mock', licensePlate: 'LUR528', unitNumber: 'HRZ-1' }])).toBeNull();
  });
  it('empty, or one character, names nothing', () => {
    expect(exactCarId('', cars)).toBeNull();
    expect(exactCarId('L', cars)).toBeNull();
  });
});

describe('archivedCarFor', () => {
  it('finds the archived car by plate, then by unit', () => {
    expect(archivedCarFor('LUR357', '', cars)?.id).toBe('c');
    expect(archivedCarFor('', '5429451', cars)?.id).toBe('a');
  });
  it('nothing when neither key names one', () => {
    expect(archivedCarFor('ZZZ999', null, cars)).toBeUndefined();
    expect(archivedCarFor(undefined, undefined, cars)).toBeUndefined();
  });
});
