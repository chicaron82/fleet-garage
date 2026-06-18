import { describe, it, expect } from 'vitest';
import {
  holdInCategory, releaseStreak, categoryStreak, chronicVehicles, CHRONIC_THRESHOLD,
} from './chronicIssues';
import type { Vehicle, Hold, HoldType, ReleaseType } from '../types';

function veh(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1', unitNumber: '5506', licensePlate: '960NFC',
    make: 'Ford', model: 'Escape', year: 2026, color: 'White',
    status: 'CLEAR', branchId: 'YWG', isTesla: false,
    hasMobileCable: null, hasJ1772Adapter: null,
    ...over,
  };
}

let seq = 0;
// `t` orders holds: a higher `t` is newer (more recent flaggedAt).
function hold(status: Hold['status'], types: HoldType[], t: number, release?: ReleaseType, vehicleId = 'v1'): Hold {
  return {
    id: `h${seq++}`, vehicleId,
    holdTypes: types, holdType: types[0], resolvedTypes: [],
    damageDescription: '', notes: '',
    flaggedById: 'u1', flaggedByName: 'VSA', flaggedByEmployeeId: 'E1',
    flaggedAt: `2026-06-${String(t).padStart(2, '0')}T08:00:00.000Z`,
    status, branchId: 'YWG',
    ...(release ? { release: { releaseType: release } as Hold['release'] } : {}),
  };
}

describe('holdInCategory', () => {
  it('matches mechanical holds to mechanical only', () => {
    const h = hold('RELEASED', ['mechanical'], 1);
    expect(holdInCategory(h, 'mechanical')).toBe(true);
    expect(holdInCategory(h, 'damage')).toBe(false);
  });
  it('matches damage and hail to the damage category', () => {
    expect(holdInCategory(hold('RELEASED', ['damage'], 1), 'damage')).toBe(true);
    expect(holdInCategory(hold('RELEASED', ['hail'], 1), 'damage')).toBe(true);
  });
  it('counts a hold toward both categories when it is both', () => {
    const h = hold('RELEASED', ['damage', 'mechanical'], 1);
    expect(holdInCategory(h, 'mechanical')).toBe(true);
    expect(holdInCategory(h, 'damage')).toBe(true);
  });
  it('detail / sale_car / missing_accessories belong to neither', () => {
    for (const t of ['detail', 'sale_car', 'missing_accessories'] as HoldType[]) {
      const h = hold('RELEASED', [t], 1);
      expect(holdInCategory(h, 'mechanical')).toBe(false);
      expect(holdInCategory(h, 'damage')).toBe(false);
    }
  });
});

describe('releaseStreak (combined)', () => {
  it('counts consecutive RELEASED + RETURNED, newest-first', () => {
    const holds = [
      hold('RELEASED', ['damage'], 3),
      hold('RETURNED', ['damage'], 2),
      hold('RELEASED', ['mechanical'], 1),
    ];
    expect(releaseStreak(holds, 'v1')).toBe(3);
  });
  it('breaks on the first REPAIRED hold', () => {
    const holds = [
      hold('RELEASED', ['damage'], 3),
      hold('REPAIRED', ['damage'], 2),
      hold('RELEASED', ['damage'], 1),
    ];
    expect(releaseStreak(holds, 'v1')).toBe(1);
  });
  it('breaks on a PRE_EXISTING release (accepted damage is not unrepaired)', () => {
    const holds = [
      hold('RELEASED', ['damage'], 2, 'PRE_EXISTING'),
      hold('RELEASED', ['damage'], 1),
    ];
    expect(releaseStreak(holds, 'v1')).toBe(0);
  });
  it('ignores ACTIVE holds and other vehicles', () => {
    const holds = [
      hold('ACTIVE', ['damage'], 4),
      hold('RELEASED', ['damage'], 3),
      hold('RELEASED', ['damage'], 2, undefined, 'other'),
    ];
    expect(releaseStreak(holds, 'v1')).toBe(1);
  });
});

describe('categoryStreak (separate)', () => {
  it('a mechanical repair does NOT reset the damage streak', () => {
    // newest → oldest: damage, mechanical REPAIRED, damage, damage
    const holds = [
      hold('RELEASED', ['damage'], 4),
      hold('REPAIRED', ['mechanical'], 3),
      hold('RELEASED', ['damage'], 2),
      hold('RELEASED', ['damage'], 1),
    ];
    expect(categoryStreak(holds, 'v1', 'damage')).toBe(3);
    // combined would break at the mechanical repair after the first
    expect(releaseStreak(holds, 'v1')).toBe(1);
  });
  it('a damage repair does not reset the mechanical streak', () => {
    const holds = [
      hold('RELEASED', ['mechanical'], 4),
      hold('REPAIRED', ['damage'], 3),
      hold('RELEASED', ['mechanical'], 2),
    ];
    expect(categoryStreak(holds, 'v1', 'mechanical')).toBe(2);
  });
  it('a both-category hold counts on each streak', () => {
    const holds = [hold('RELEASED', ['damage', 'mechanical'], 1)];
    expect(categoryStreak(holds, 'v1', 'damage')).toBe(1);
    expect(categoryStreak(holds, 'v1', 'mechanical')).toBe(1);
  });
});

describe('chronicVehicles', () => {
  const threeDamage = (id: string) => [
    hold('RELEASED', ['damage'], 3, undefined, id),
    hold('RELEASED', ['damage'], 2, undefined, id),
    hold('RELEASED', ['damage'], 1, undefined, id),
  ];

  it('surfaces a vehicle at the threshold in one category', () => {
    const v = veh({ id: 'va' });
    const out = chronicVehicles([v], threeDamage('va'));
    expect(out).toHaveLength(1);
    expect(out[0].damage).toBe(CHRONIC_THRESHOLD);
    expect(out[0].mechanical).toBe(0);
    expect(out[0].worst).toBe(3);
  });
  it('excludes a vehicle below threshold in both categories', () => {
    const v = veh({ id: 'vb' });
    const holds = [hold('RELEASED', ['damage'], 2, undefined, 'vb'), hold('RELEASED', ['mechanical'], 1, undefined, 'vb')];
    expect(chronicVehicles([v], holds)).toHaveLength(0);
  });
  it('sorts worst-first by the higher of the two streaks', () => {
    const a = veh({ id: 'va', unitNumber: 'A' });
    const b = veh({ id: 'vb', unitNumber: 'B' });
    const holds = [
      ...threeDamage('va'),
      ...[5, 4, 3, 2, 1].map(t => hold('RELEASED', ['mechanical'], t, undefined, 'vb')),
    ];
    const out = chronicVehicles([a, b], holds);
    expect(out.map(e => e.vehicle.id)).toEqual(['vb', 'va']); // 5 before 3
  });
  it('respects a custom threshold', () => {
    const v = veh({ id: 'vc' });
    const holds = [hold('RELEASED', ['damage'], 2, undefined, 'vc'), hold('RELEASED', ['damage'], 1, undefined, 'vc')];
    expect(chronicVehicles([v], holds, 2)).toHaveLength(1);
    expect(chronicVehicles([v], holds, 3)).toHaveLength(0);
  });
});
