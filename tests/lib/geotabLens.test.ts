import { describe, it, expect } from 'vitest';
import { geotabLens } from '../../src/lib/geotabLens';
import type { Hold, Vehicle } from '../../src/types';

// Aaron, 2026-09-25: "may i ask why FG only has 11 that need a geotab installed but the list has 14?"
const car = (id: string, plate: string, extra: Partial<Vehicle> = {}) =>
  ({ id, licensePlate: plate, make: '', model: '', status: 'CLEAR', branchId: 'YWG', ...extra }) as Vehicle;
const geotabHold = (vehicleId: string, status: Hold['status']) =>
  ({ id: `h-${vehicleId}`, vehicleId, damageDescription: 'Geotab not installed', status }) as Hold;

const vehicles = [
  car('v1', 'KGE609', { status: 'OUT_ON_EXCEPTION' }),
  car('v2', 'LFJ339'),                       // pending since August, never had a hold
  car('v3', 'LUR532'),                       // reopened on the watchlist, hold closed long ago
  car('v4', 'LJF693', { status: 'OUT_ON_EXCEPTION' }), // installed, stale hold still open
];
const holds: Record<string, Hold[]> = {
  v1: [geotabHold('v1', 'RELEASED')],
  v3: [geotabHold('v3', 'RETURNED')],
  v4: [geotabHold('v4', 'RELEASED')],
};
const holdsFor = (id: string) => holds[id] ?? [];

describe('the geotab list is the watchlist', () => {
  const pending = new Set(['KGE609', 'LFJ339', 'LUR532']);
  const lens = geotabLens(pending, vehicles, holdsFor);

  it('⭐ lists every pending plate, one row each, whatever the holds say', () => {
    expect(lens.map(i => i.plate)).toEqual(['KGE609', 'LFJ339', 'LUR532']);
  });

  it('⭐ a plate marked installed is off the list even with a stale open hold (LJF693)', () => {
    expect(lens.some(i => i.plate === 'LJF693')).toBe(false);
  });

  it('carries the open exception when there is one, and nothing when the hold is closed or absent', () => {
    expect(lens.find(i => i.plate === 'KGE609')?.hold?.id).toBe('h-v1');
    expect(lens.find(i => i.plate === 'LUR532')?.hold).toBeUndefined();
    expect(lens.find(i => i.plate === 'LFJ339')?.hold).toBeUndefined();
    expect(lens.find(i => i.plate === 'LFJ339')?.vehicle?.id).toBe('v2');
  });

  it('keeps a pending plate no live car carries, and skips archived cars', () => {
    const l = geotabLens(new Set(['LZM999', 'KGE609']), [car('v9', 'KGE609', { archivedAt: '2026-09-16' })], holdsFor);
    expect(l).toEqual([{ plate: 'KGE609' }, { plate: 'LZM999' }]);
  });
});
