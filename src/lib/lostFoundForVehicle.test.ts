import { describe, it, expect } from 'vitest';
import { lostFoundForVehicle } from './lostFoundForVehicle';
import type { LostFoundItem, LostFoundStatus } from '../types';

const item = (id: string, over: Partial<LostFoundItem> = {}): LostFoundItem => ({
  id, branchId: 'YWG', foundById: 'u1', foundByName: 'VSA',
  foundAt: '2026-06-14T10:00:00Z', status: 'holding' as LostFoundStatus,
  licensePlate: 'LUR207', ...over,
});

const vehicle = { licensePlate: 'LUR207', unitNumber: '5512' };

describe('lostFoundForVehicle', () => {
  it('matches an unresolved item by plate (case-insensitive)', () => {
    expect(lostFoundForVehicle([item('a', { licensePlate: 'lur207' })], vehicle).map(i => i.id)).toEqual(['a']);
  });

  it('matches by unit number when the plate differs/absent', () => {
    expect(lostFoundForVehicle([item('b', { licensePlate: undefined, unitNumber: '5512' })], vehicle).map(i => i.id)).toEqual(['b']);
  });

  it('excludes resolved items (returned / disposed)', () => {
    const items = [item('r', { status: 'returned' }), item('d', { status: 'disposed' })];
    expect(lostFoundForVehicle(items, vehicle)).toEqual([]);
  });

  it('keeps customer_contacted (still in possession)', () => {
    expect(lostFoundForVehicle([item('c', { status: 'customer_contacted' })], vehicle).map(i => i.id)).toEqual(['c']);
  });

  it('a non-fleet plate matches nothing — item stays only in L&F', () => {
    expect(lostFoundForVehicle([item('x', { licensePlate: 'ABC999', unitNumber: undefined })], vehicle)).toEqual([]);
  });
});
