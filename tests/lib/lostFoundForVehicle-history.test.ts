import { describe, it, expect } from 'vitest';
import { lostFoundHistoryForVehicle } from '../../src/lib/lostFoundForVehicle';
import type { LostFoundItem, LostFoundStatus } from '../../src/types';

const car = { licensePlate: 'LUR212', unitNumber: '5424601' };

const item = (id: string, status: LostFoundStatus, foundAt: string): LostFoundItem =>
  ({ id, status, foundAt, description: id, licensePlate: 'LUR212', unitNumber: '5424601',
     foundByName: 'Aaron S.' } as LostFoundItem);

describe('lostFoundHistoryForVehicle', () => {
  it('splits what is still ours from what is done', () => {
    const { active, resolved } = lostFoundHistoryForVehicle([
      item('bottle', 'holding', '2026-08-27T10:00:00Z'),
      item('phone', 'customer_contacted', '2026-08-26T10:00:00Z'),
      item('wrapper', 'disposed', '2026-08-20T10:00:00Z'),
      item('bag', 'returned', '2026-08-10T10:00:00Z'),
    ], car);
    expect(active.map(i => i.id)).toEqual(['bottle', 'phone']);
    expect(resolved.map(i => i.id)).toEqual(['wrapper', 'bag']);
  });

  // ⭐⭐⭐ THE WHOLE POINT. A car with one tossed bottle and nothing live must STILL have something to
  // say. Before this, that car's record was silent — the data kept, nothing rendering it.
  it('still returns history when everything is resolved', () => {
    const { active, resolved } = lostFoundHistoryForVehicle(
      [item('wrapper', 'disposed', '2026-08-20T10:00:00Z')], car);
    expect(active).toEqual([]);
    expect(resolved).toHaveLength(1);
  });

  // ⚠️ Sorted here, not by whatever order the context loaded. A history whose order depends on the
  // query is a bug waiting for someone to change the query.
  it('orders both lists newest first, whatever order they arrive in', () => {
    const { resolved } = lostFoundHistoryForVehicle([
      item('old', 'disposed', '2026-01-01T10:00:00Z'),
      item('new', 'returned', '2026-08-01T10:00:00Z'),
      item('mid', 'disposed', '2026-05-01T10:00:00Z'),
    ], car);
    expect(resolved.map(i => i.id)).toEqual(['new', 'mid', 'old']);
  });

  it('matches by unit number when the item has no plate', () => {
    const noPlate = { ...item('x', 'disposed', '2026-08-01T10:00:00Z'), licensePlate: undefined } as LostFoundItem;
    expect(lostFoundHistoryForVehicle([noPlate], car).resolved).toHaveLength(1);
  });

  it('ignores items found in a different car', () => {
    const other = { ...item('y', 'holding', '2026-08-01T10:00:00Z'), licensePlate: 'LUR999', unitNumber: '9999999' } as LostFoundItem;
    const { active, resolved } = lostFoundHistoryForVehicle([other], car);
    expect(active).toEqual([]);
    expect(resolved).toEqual([]);
  });

  it('is empty for a car that has never produced an item', () => {
    expect(lostFoundHistoryForVehicle([], car)).toEqual({ active: [], resolved: [] });
  });
});
