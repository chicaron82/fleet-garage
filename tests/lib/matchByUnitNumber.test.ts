import { describe, it, expect } from 'vitest';
import { matchByUnitNumber, normalizeUnit, matchedByUnitLabel } from '../../src/lib/matchByUnitNumber';
import type { Vehicle } from '../../src/types';

const car = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', unitNumber: '5424940', licensePlate: 'LUR249',
  make: 'Volkswagen', model: 'Taos', year: 2025, color: 'Black',
  status: 'CLEAR', branchId: 'YWG',
  ...o,
} as Vehicle);

describe('normalizeUnit', () => {
  it('⭐ strips the spacing the TAG prints — "542 4940" is how it reads, 5424940 is how FG stores it', () => {
    expect(normalizeUnit('542 4940')).toBe('5424940');
  });

  it('survives nulls and junk rather than throwing', () => {
    expect(normalizeUnit(null)).toBe('');
    expect(normalizeUnit(undefined)).toBe('');
    expect(normalizeUnit('  ')).toBe('');
  });
});

describe('matchByUnitNumber', () => {
  it('⭐ identifies the car from the unit alone — the crumpled-tag case', () => {
    // Aaron's tag: plate and model torn away, "Veh #: 542 4940" still crisp.
    const m = matchByUnitNumber('542 4940', [car(), car({ id: 'other', unitNumber: '9999999' })]);
    expect(m.kind).toBe('one');
    if (m.kind === 'one') expect(m.vehicle.licensePlate).toBe('LUR249');
  });

  it('⭐ refuses to guess when two live cars share the unit', () => {
    // Three such pairs exist in the live fleet (5427497, 5738117, 5421656) — a unit gets
    // reassigned and the old row isn't archived. Guessing here would attach the scan to the
    // wrong car, which is the wrong-provenance class of bug this app keeps having to avoid.
    const m = matchByUnitNumber('5427497', [
      car({ id: 'a', unitNumber: '5427497', licensePlate: 'AAA111' }),
      car({ id: 'b', unitNumber: '5427497', licensePlate: 'BBB222' }),
    ]);
    expect(m.kind).toBe('ambiguous');
    if (m.kind === 'ambiguous') expect(m.vehicles).toHaveLength(2);
  });

  it('returns none for an unknown unit, and for no unit at all', () => {
    expect(matchByUnitNumber('1234567', [car()]).kind).toBe('none');
    expect(matchByUnitNumber('', [car()]).kind).toBe('none');
    expect(matchByUnitNumber(null, [car()]).kind).toBe('none');
  });

  it('⭐ does NOT match a vehicle whose own unit is blank against an empty read', () => {
    // 39 live vehicles have no unit number. An empty-matches-empty bug would resolve every
    // plateless scan onto whichever of those happened to sort first.
    expect(matchByUnitNumber('', [car({ unitNumber: null })]).kind).toBe('none');
    expect(matchByUnitNumber('5424940', [car({ unitNumber: null })]).kind).toBe('none');
  });
});

describe('matchedByUnitLabel', () => {
  it('says which key did the work, and why the plate did not', () => {
    expect(matchedByUnitLabel(true, '542 4940')).toContain('5424940');
    expect(matchedByUnitLabel(true, '542 4940')).toMatch(/plate/i);
  });

  it('stays silent on the normal plate-matched path', () => {
    expect(matchedByUnitLabel(false, '5424940')).toBe('');
  });
});
