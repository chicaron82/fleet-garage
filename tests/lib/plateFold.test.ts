// O and 0 are one key when a plate is TYPED (src/lib/plateFold.ts). Aaron, 2026-10-29, on the bay log's Find a car:
// 0GK487 is the plate that gets typed OGK487. docs/ticket-bay-find-a-car-inline-search.md.
import { describe, it, expect } from 'vitest';
import { foldOZero, oZeroVariants } from '../../src/lib/plateFold';
import { rankVehicleMatches, type VehicleSearchResult } from '../../src/lib/ev-detection';

describe('foldOZero', () => {
  it('reads every O as 0, case-blind; nothing else moves', () => {
    expect(foldOZero('OGK487')).toBe('0GK487');
    expect(foldOZero('ogk487')).toBe('0GK487');
    expect(foldOZero('LUR164')).toBe('LUR164');
  });
});

describe('oZeroVariants: what the search asks the database for', () => {
  it('as typed, every O as 0, and every 0 as O, once each', () => {
    expect(oZeroVariants('OGK48')).toEqual(['OGK48', '0GK48']);
    expect(oZeroVariants('0GK48')).toEqual(['0GK48', 'OGK48']);
    expect(oZeroVariants('gk48')).toEqual(['GK48']);
  });
});

const car = (license_plate: string, unit_number: string | null = null): VehicleSearchResult => ({
  license_plate, unit_number, make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray', is_hybrid: false, is_tesla: false, archived_at: null,
});

describe('rankVehicleMatches with O and 0 swapped', () => {
  // ⚠️ Digits sort before letters, so a 0-plate tops the list alphabetically whatever the ranker thinks. These cases
  // are built so the alphabetical order is WRONG and only the folded starts-with puts the right car first.
  it('⭐ 0AB1 typed for OAB123 ranks it as a starts-with hit, above 10AB12 which only contains it', () => {
    const out = rankVehicleMatches([car('10AB12'), car('OAB123')], 5, '0AB1');
    expect(out.map(v => v.license_plate)).toEqual(['OAB123', '10AB12']);
  });
  it('the same for OGK487 typed for 0GK487, against a contains-hit that sorts first', () => {
    const out = rankVehicleMatches([car('00GK487'), car('0GK487')], 5, 'OGK487');
    expect(out.map(v => v.license_plate)).toEqual(['0GK487', '00GK487']);
  });
});
