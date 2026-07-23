import { describe, it, expect } from 'vitest';
import { lostFoundForVehicle } from '../../src/lib/lostFoundForVehicle';
import type { LostFoundItem, LostFoundStatus } from '../../src/types';

const item = (over: Partial<LostFoundItem> = {}): LostFoundItem =>
  ({
    id: 'i1',
    status: 'holding' as LostFoundStatus,
    licensePlate: 'ABC123',
    unitNumber: '101',
    ...over,
  } as LostFoundItem);

const car = { licensePlate: 'ABC123', unitNumber: '101' };

describe('lostFoundForVehicle', () => {
  it('matches an unresolved item by plate', () => {
    const items = [item({ id: 'a', licensePlate: 'ABC123', unitNumber: undefined })];
    expect(lostFoundForVehicle(items, car).map(i => i.id)).toEqual(['a']);
  });

  it('matches an unresolved item by unit# when the plate differs', () => {
    const items = [item({ id: 'a', licensePlate: 'OTHER', unitNumber: '101' })];
    expect(lostFoundForVehicle(items, car).map(i => i.id)).toEqual(['a']);
  });

  it('matches case-insensitively with whitespace tolerance', () => {
    const items = [item({ id: 'a', licensePlate: ' abc123 ', unitNumber: undefined })];
    expect(lostFoundForVehicle(items, car).map(i => i.id)).toEqual(['a']);
  });

  it('excludes resolved (returned/disposed) items', () => {
    const items = [
      item({ id: 'a', status: 'returned' as LostFoundStatus }),
      item({ id: 'b', status: 'disposed' as LostFoundStatus }),
    ];
    expect(lostFoundForVehicle(items, car)).toEqual([]);
  });

  it('includes customer_contacted as still-unresolved', () => {
    const items = [item({ id: 'a', status: 'customer_contacted' as LostFoundStatus })];
    expect(lostFoundForVehicle(items, car).map(i => i.id)).toEqual(['a']);
  });

  it('does not match an item belonging to a different car', () => {
    const items = [item({ id: 'a', licensePlate: 'ZZZ999', unitNumber: '888' })];
    expect(lostFoundForVehicle(items, car)).toEqual([]);
  });

  it('matches by unit# when the plate field is absent (undefined)', () => {
    const items = [item({ id: 'a', licensePlate: undefined, unitNumber: '101' })];
    expect(lostFoundForVehicle(items, car).map(i => i.id)).toEqual(['a']);
  });
});
