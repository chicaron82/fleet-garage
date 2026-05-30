import { describe, it, expect } from 'vitest';
import { isTesla } from '../../src/lib/vehicles';
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
