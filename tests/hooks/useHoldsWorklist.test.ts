import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHoldsWorklist } from '../../src/hooks/useHoldsWorklist';
import type { Vehicle, VehicleStatus } from '../../src/types';

// Only the fields the worklist reads.
const car = (id: string, status: VehicleStatus) =>
  ({ id, status, licensePlate: id, unitNumber: '5420000', make: 'Nissan', model: 'Rogue' }) as unknown as Vehicle;

const fleet = [car('HELD1', 'HELD'), car('SALE1', 'SALE_CAR'), car('SALE2', 'SALE_CAR'), car('CLR1', 'CLEAR')];

const run = (over: Partial<Parameters<typeof useHoldsWorklist>[0]> = {}) =>
  renderHook(() => useHoldsWorklist({
    vehicles: fleet, holds: [], archivedVehicles: [], search: '', activeStatusFilter: null,
    pinnedVehicleIds: new Set(), currentPage: 1, ...over,
  })).result.current;

// Aaron, 2026-09-10: "unchecked hides them. can still be searched."
describe('useHoldsWorklist — sale cars behind a checkbox', () => {
  it('hides SALE_CAR from the default list, and says how many there are', () => {
    const w = run();
    expect(w.filtered.map(v => v.id)).toEqual(['HELD1']);
    expect(w.saleCarCount).toBe(2);
  });

  it('shows them when the box is ticked', () => {
    expect(run({ showSaleCars: true }).filtered.map(v => v.id).sort()).toEqual(['HELD1', 'SALE1', 'SALE2']);
  });

  it('⭐ a search still finds a sale car with the box unticked', () => {
    expect(run({ search: 'SALE1' }).filtered.map(v => v.id)).toEqual(['SALE1']);
  });
});
