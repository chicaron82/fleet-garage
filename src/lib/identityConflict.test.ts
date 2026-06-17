import { describe, it, expect } from 'vitest';
import { findUnitConflict } from './identityConflict';
import type { Vehicle } from '../types';

function v(id: string, unitNumber: string | null, over: Partial<Vehicle> = {}): Vehicle {
  return {
    id, unitNumber, licensePlate: 'ABC 123',
    make: 'Toyota', model: 'RAV4', year: 2022, color: 'White',
    status: 'CLEAR', branchId: 'YWG',
    isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
    ...over,
  };
}

describe('findUnitConflict', () => {
  const fleet = [v('a', '5428735'), v('b', '4916466'), v('c', null)];

  it('finds a different vehicle already carrying the unit number', () => {
    expect(findUnitConflict('5428735', fleet)?.id).toBe('a');
  });

  it('matches case-insensitively and trims whitespace', () => {
    expect(findUnitConflict('  4916466  ', fleet)?.id).toBe('b');
  });

  it('returns undefined when no vehicle holds the number', () => {
    expect(findUnitConflict('9999999', fleet)).toBeUndefined();
  });

  it('blank or whitespace input never conflicts', () => {
    expect(findUnitConflict('', fleet)).toBeUndefined();
    expect(findUnitConflict('   ', fleet)).toBeUndefined();
  });

  it('excludes the record under edit (no self-conflict)', () => {
    expect(findUnitConflict('5428735', fleet, 'a')).toBeUndefined();
  });

  it('ignores archived vehicles — a retired record is not a live collision', () => {
    const withArchived = [v('z', '5428735', { archivedAt: '2026-01-01T00:00:00Z' })];
    expect(findUnitConflict('5428735', withArchived)).toBeUndefined();
  });
});
