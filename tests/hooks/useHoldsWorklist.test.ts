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
    currentPage: 1, ...over,
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

// docs/ticket-holds-filter-pills.md — Aaron, 2026-09-30: "pills to filter the most flagged ones".
describe('useHoldsWorklist — kind pills', () => {
  const held = [car('H1', 'HELD'), car('H2', 'HELD'), car('H3', 'HELD')];
  const hold = (vehicleId: string, over: Record<string, unknown>) => ({
    id: `h-${vehicleId}`, vehicleId, status: 'ACTIVE', holdTypes: ['damage'], resolvedTypes: [],
    damageDescription: '', damageZones: [], flaggedAt: '2026-09-29T16:00:00Z', ...over,
  }) as unknown as import('../../src/types').Hold;
  const holds = [
    hold('H1', { holdTypes: ['hail'] }), hold('H2', { holdTypes: ['hail'] }),
    hold('H3', { holdTypes: ['mechanical'], mechanicalSubType: 'safety-recall' }),
  ];

  it('narrows the list to the cars carrying the kind', () => {
    expect(run({ vehicles: held, holds, activeKind: 'recall' }).filtered.map(v => v.id)).toEqual(['H3']);
  });

  // ⚠️ Counted after the narrowing, the selected pill would only count itself and the rest would read 0.
  it('⭐ counts every pill from the list BEFORE the pill narrows it', () => {
    const w = run({ vehicles: held, holds, activeKind: 'recall' });
    expect(w.kindPills.map(p => [p.kind, p.count])).toEqual([['hail', 2], ['recall', 1]]);
  });

  // ⚠️ noMatch flips the search button to "Add to FG & flag" — a pill hiding a found car must not do that.
  it('⚠️ a search the pill hides is not a "no match"', () => {
    const w = run({ vehicles: held, holds, activeKind: 'recall', search: 'H1' });
    expect(w.filtered).toEqual([]);
    expect(w.noMatch).toBe(false);
  });
});

// LUR306, 2026-09-30: a bumper hold + a newer hail hold. Under Damage its card said "Hail damage".
describe('useHoldsWorklist — the card matches the pill', () => {
  const fleet306 = [car('LUR306', 'HELD')];
  const mk = (id: string, over: Record<string, unknown>) => ({
    id, vehicleId: 'LUR306', status: 'ACTIVE', resolvedTypes: [], damageZones: [],
    flaggedAt: '2026-09-29T16:00:00Z', ...over,
  }) as unknown as import('../../src/types').Hold;
  const holds = [
    mk('hail', { holdTypes: ['hail'], damageDescription: 'Hail damage', damageZones: ['hood', 'roof'] }),
    mk('bumper', { holdTypes: ['damage'], damageDescription: 'Bumper damage — cosmetic', damageZones: ['front-bumper'] }),
  ];

  it('⭐ under Damage the card shows the damage hold', () => {
    expect(run({ vehicles: fleet306, holds, activeKind: 'damage' }).getDisplayHold('LUR306', 'HELD')?.id).toBe('bumper');
  });

  it('under Hail the same car shows the hail hold', () => {
    expect(run({ vehicles: fleet306, holds, activeKind: 'hail' }).getDisplayHold('LUR306', 'HELD')?.id).toBe('hail');
  });

  it('with no pill, the card is chosen exactly as before', () => {
    expect(run({ vehicles: fleet306, holds }).getDisplayHold('LUR306', 'HELD')?.id).toBe('hail');
  });
});
