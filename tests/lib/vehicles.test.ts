import { describe, it, expect } from 'vitest';
import { isTesla, plausibleYearOr } from '../../src/lib/vehicles';
import type { Vehicle } from '../../src/types';

function vehicle(make: string): Vehicle {
  return { make } as Vehicle;
}

describe('isTesla', () => {
  it('is true for Tesla regardless of case', () => {
    expect(isTesla(vehicle('Tesla'))).toBe(true);
    expect(isTesla(vehicle('tesla'))).toBe(true);
    expect(isTesla(vehicle('TESLA'))).toBe(true);
  });

  it('is false for other makes', () => {
    expect(isTesla(vehicle('Toyota'))).toBe(false);
    expect(isTesla(vehicle(''))).toBe(false);
  });
});

describe('plausibleYearOr', () => {
  const CURRENT = 2026;

  it('keeps a plausible fleet year unchanged', () => {
    expect(plausibleYearOr(2021, CURRENT)).toBe(2021);
    expect(plausibleYearOr(2000, CURRENT)).toBe(2000); // exactly the floor
    expect(plausibleYearOr(CURRENT, CURRENT)).toBe(CURRENT);
    expect(plausibleYearOr(CURRENT + 1, CURRENT)).toBe(CURRENT + 1); // next model year is valid
  });

  it('falls back when the scanned year is missing', () => {
    expect(plausibleYearOr(null, CURRENT)).toBe(CURRENT);
    expect(plausibleYearOr(undefined, CURRENT)).toBe(CURRENT);
  });

  it('falls back on a below-floor mis-read (the reported case)', () => {
    expect(plausibleYearOr(10, CURRENT)).toBe(CURRENT);   // handwritten "10"
    expect(plausibleYearOr(0, CURRENT)).toBe(CURRENT);    // blank-field sentinel
    expect(plausibleYearOr(1999, CURRENT)).toBe(CURRENT); // just under the floor
  });

  it('falls back on a garbage-high mis-read', () => {
    expect(plausibleYearOr(20210, CURRENT)).toBe(CURRENT);
    expect(plausibleYearOr(CURRENT + 2, CURRENT)).toBe(CURRENT); // more than one year ahead
  });
});
