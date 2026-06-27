import { describe, it, expect } from 'vitest';
import {
  holdInCategory,
  releaseStreak,
  categoryStreak,
  chronicVehicles,
  CHRONIC_THRESHOLD,
} from '../../src/lib/chronicIssues';
import type { Hold, Vehicle } from '../../src/types';

// flaggedAt drives newest-first ordering; give each hold a distinct day so the
// streak walk order is deterministic regardless of input order.
let seq = 0;
function makeHold(overrides: Partial<Hold> = {}): Hold {
  seq += 1;
  return {
    id: `h${seq}`,
    vehicleId: 'v1',
    holdTypes: ['mechanical'],
    holdType: 'mechanical',
    status: 'RELEASED',
    flaggedAt: new Date(2026, 0, seq).toISOString(),
    branchId: 'YWG',
    damageDescription: '',
    notes: '',
    flaggedById: 'u1',
    photos: [],
    ...overrides,
  } as Hold;
}

function makeVehicle(id: string): Vehicle {
  return { id } as Vehicle;
}

describe('holdInCategory', () => {
  it('matches mechanical to the mechanical category', () => {
    expect(holdInCategory(makeHold({ holdTypes: ['mechanical'] }), 'mechanical')).toBe(true);
    expect(holdInCategory(makeHold({ holdTypes: ['mechanical'] }), 'damage')).toBe(false);
  });

  it('counts both damage and hail toward damage', () => {
    expect(holdInCategory(makeHold({ holdTypes: ['damage'] }), 'damage')).toBe(true);
    expect(holdInCategory(makeHold({ holdTypes: ['hail'] }), 'damage')).toBe(true);
  });

  it('excludes detail / sale_car / missing_accessories from both categories', () => {
    for (const t of ['detail', 'sale_car', 'missing_accessories'] as const) {
      const h = makeHold({ holdTypes: [t] });
      expect(holdInCategory(h, 'mechanical')).toBe(false);
      expect(holdInCategory(h, 'damage')).toBe(false);
    }
  });

  it('a multi-type hold matches every category it touches', () => {
    const h = makeHold({ holdTypes: ['mechanical', 'damage'] });
    expect(holdInCategory(h, 'mechanical')).toBe(true);
    expect(holdInCategory(h, 'damage')).toBe(true);
  });

  it('falls back to the single holdType when holdTypes is empty', () => {
    const h = makeHold({ holdTypes: [], holdType: 'mechanical' });
    expect(holdInCategory(h, 'mechanical')).toBe(true);
  });
});

describe('releaseStreak', () => {
  it('counts consecutive released-unrepaired holds newest-first', () => {
    const holds = [
      makeHold({ status: 'RELEASED' }),
      makeHold({ status: 'RETURNED' }),
      makeHold({ status: 'RELEASED' }),
    ];
    expect(releaseStreak(holds, 'v1')).toBe(3);
  });

  it('breaks the chain at a REPAIRED hold', () => {
    const older = makeHold({ status: 'RELEASED' });
    const repaired = makeHold({ status: 'REPAIRED' });
    const newest = makeHold({ status: 'RELEASED' });
    expect(releaseStreak([older, repaired, newest], 'v1')).toBe(1);
  });

  it('breaks the chain at a PRE_EXISTING release (accepted damage)', () => {
    const older = makeHold({ status: 'RELEASED' });
    const preExisting = makeHold({
      status: 'RELEASED',
      release: { releaseType: 'PRE_EXISTING' },
    } as Partial<Hold>);
    const newest = makeHold({ status: 'RELEASED' });
    expect(releaseStreak([older, preExisting, newest], 'v1')).toBe(1);
  });

  it('skips VOIDED holds without counting or breaking', () => {
    const older = makeHold({ status: 'RELEASED' });
    const voided = makeHold({ status: 'VOIDED' });
    const newest = makeHold({ status: 'RELEASED' });
    expect(releaseStreak([older, voided, newest], 'v1')).toBe(2);
  });

  it('ignores ACTIVE holds and other vehicles', () => {
    const active = makeHold({ status: 'ACTIVE' });
    const otherCar = makeHold({ vehicleId: 'v2', status: 'RELEASED' });
    const mine = makeHold({ status: 'RELEASED' });
    expect(releaseStreak([active, otherCar, mine], 'v1')).toBe(1);
  });

  it('is zero for a vehicle with no completed holds', () => {
    expect(releaseStreak([makeHold({ status: 'ACTIVE' })], 'v1')).toBe(0);
  });
});

describe('categoryStreak', () => {
  it('walks only the requested category', () => {
    const holds = [
      makeHold({ holdTypes: ['mechanical'], status: 'RELEASED' }),
      makeHold({ holdTypes: ['damage'], status: 'RELEASED' }),
      makeHold({ holdTypes: ['mechanical'], status: 'RELEASED' }),
    ];
    expect(categoryStreak(holds, 'v1', 'mechanical')).toBe(2);
    expect(categoryStreak(holds, 'v1', 'damage')).toBe(1);
  });

  it('a mechanical repair does not reset the damage streak', () => {
    const holds = [
      makeHold({ holdTypes: ['damage'], status: 'RELEASED' }),
      makeHold({ holdTypes: ['mechanical'], status: 'REPAIRED' }),
      makeHold({ holdTypes: ['damage'], status: 'RELEASED' }),
    ];
    // damage walk never sees the mechanical REPAIRED hold, so it stays at 2
    expect(categoryStreak(holds, 'v1', 'damage')).toBe(2);
  });

  it('a multi-type hold counts toward each of its categories', () => {
    const holds = [makeHold({ holdTypes: ['damage', 'mechanical'], status: 'RELEASED' })];
    expect(categoryStreak(holds, 'v1', 'damage')).toBe(1);
    expect(categoryStreak(holds, 'v1', 'mechanical')).toBe(1);
  });
});

describe('chronicVehicles', () => {
  const released = (vehicleId: string, holdTypes: Hold['holdTypes']) =>
    makeHold({ vehicleId, holdTypes, status: 'RELEASED' });

  it('surfaces vehicles at or over the threshold, worst-first', () => {
    const vehicles = [makeVehicle('a'), makeVehicle('b'), makeVehicle('c')];
    const holds = [
      // a: 3 mechanical (== threshold)
      ...Array.from({ length: 3 }, () => released('a', ['mechanical'])),
      // b: 4 damage (worst)
      ...Array.from({ length: 4 }, () => released('b', ['damage'])),
      // c: 2 mechanical (below threshold)
      ...Array.from({ length: 2 }, () => released('c', ['mechanical'])),
    ];
    const result = chronicVehicles(vehicles, holds);
    expect(result.map(e => e.vehicle.id)).toEqual(['b', 'a']);
    expect(result[0].worst).toBe(4);
    expect(result[1].worst).toBe(3);
  });

  it('respects a custom threshold', () => {
    const vehicles = [makeVehicle('a')];
    const holds = Array.from({ length: 2 }, () => released('a', ['mechanical']));
    expect(chronicVehicles(vehicles, holds)).toHaveLength(0);
    expect(chronicVehicles(vehicles, holds, 2)).toHaveLength(1);
  });

  it('defaults to CHRONIC_THRESHOLD', () => {
    expect(CHRONIC_THRESHOLD).toBe(3);
  });
});
