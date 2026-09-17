/**
 * ⚠️ Typing LUR486 offered a MOCK car above the real one (Aaron, 2026-09-17): a 2023 Malibu on unit
 * HRZ-3307, archived since 09-03, beside the live 2026 Trax on unit 5429592.
 */
import { describe, expect, it } from 'vitest';
import { rankVehicleMatches, type VehicleSearchResult } from '../../src/lib/ev-detection';

const car = (over: Partial<VehicleSearchResult>): VehicleSearchResult => ({
  license_plate: 'LUR486', unit_number: '5429592', make: 'Chevrolet', model: 'Trax',
  year: 2026, color: 'White', is_hybrid: false, is_tesla: false, archived_at: null, ...over,
});

describe('rankVehicleMatches', () => {
  it('⛔ drops the HRZ- mock sandbox and keeps the real car — the reported case', () => {
    const out = rankVehicleMatches([
      car({ unit_number: 'HRZ-3307', model: 'Malibu', year: 2023, archived_at: '2026-09-03T00:00:00Z' }),
      car({}),
    ]);
    expect(out.map(v => v.unit_number)).toEqual(['5429592']);
  });

  it('⚠️ a car with NO unit number survives — the NULL trap a query-side NOT LIKE would have hit', () => {
    // The geotab cars stamped 8199 on 2026-09-17 have no unit number at all. `NOT LIKE` on NULL is
    // NULL, so filtering in the query would have deleted them from every typed look-up.
    const out = rankVehicleMatches([car({ unit_number: null, license_plate: 'LUR270' })]);
    expect(out.map(v => v.license_plate)).toEqual(['LUR270']);
  });

  it('archived cars stay findable but rank BELOW live ones', () => {
    const out = rankVehicleMatches([
      car({ unit_number: '1', archived_at: '2026-09-03T00:00:00Z' }),
      car({ unit_number: '2' }),
      car({ unit_number: '3', archived_at: '2026-09-04T00:00:00Z' }),
      car({ unit_number: '4' }),
    ]);
    expect(out.map(v => v.unit_number)).toEqual(['2', '4', '1', '3']);
  });

  it('keeps the query order within live and within archived (stable)', () => {
    const out = rankVehicleMatches([car({ unit_number: 'a' }), car({ unit_number: 'b' }), car({ unit_number: 'c' })]);
    expect(out.map(v => v.unit_number)).toEqual(['a', 'b', 'c']);
  });

  it('trims to the limit AFTER filtering, so mocks never spend a visible slot', () => {
    const rows = [
      car({ unit_number: 'HRZ-1' }), car({ unit_number: 'HRZ-2' }),
      ...['1', '2', '3', '4', '5', '6'].map(u => car({ unit_number: u })),
    ];
    expect(rankVehicleMatches(rows).map(v => v.unit_number)).toEqual(['1', '2', '3', '4', '5']);
  });
});
