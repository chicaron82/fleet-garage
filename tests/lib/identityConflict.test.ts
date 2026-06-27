import { describe, it, expect } from 'vitest';
import { findUnitConflict } from '../../src/lib/identityConflict';
import type { Vehicle } from '../../src/types';

const v = (over: Partial<Vehicle>): Vehicle =>
  ({ id: 'v1', unitNumber: '101', archivedAt: null, ...over } as Vehicle);

describe('findUnitConflict', () => {
  const fleet = [v({ id: 'a', unitNumber: '101' }), v({ id: 'b', unitNumber: '202' })];

  it('finds another active vehicle carrying the same unit#', () => {
    expect(findUnitConflict('101', fleet)?.id).toBe('a');
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    const f = [v({ id: 'a', unitNumber: 'HRZ-9' })];
    expect(findUnitConflict('  hrz-9 ', f)?.id).toBe('a');
  });

  it('never conflicts on blank input', () => {
    expect(findUnitConflict('', fleet)).toBeUndefined();
    expect(findUnitConflict('   ', fleet)).toBeUndefined();
  });

  it('skips the record under edit via excludeId', () => {
    expect(findUnitConflict('101', fleet, 'a')).toBeUndefined();
  });

  it('ignores archived vehicles', () => {
    const f = [v({ id: 'a', unitNumber: '101', archivedAt: '2026-01-01' })];
    expect(findUnitConflict('101', f)).toBeUndefined();
  });

  it('returns undefined when no live vehicle matches', () => {
    expect(findUnitConflict('999', fleet)).toBeUndefined();
  });
});
