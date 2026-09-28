import { describe, it, expect } from 'vitest';
import { carsHiddenFromHolds } from '../../src/lib/hiddenHolds';
import type { Hold, Vehicle } from '../../src/types';

// LUR479 / LUR538, 2026-09-28: live PM-due holds on cars that read CLEAR, invisible on the Holds list.
const car = (id: string, status: string) => ({ id, status, licensePlate: id }) as unknown as Vehicle;
const hold = (vehicleId: string, status: string) => ({ id: `h-${vehicleId}-${status}`, vehicleId, status }) as unknown as Hold;

describe('carsHiddenFromHolds', () => {
  it('⭐ finds a CLEAR car carrying an active hold', () => {
    expect(carsHiddenFromHolds([car('LUR479', 'CLEAR')], [hold('LUR479', 'ACTIVE')]).map(v => v.id)).toEqual(['LUR479']);
  });

  it('a HELD car with an active hold is fine — the list shows it', () => {
    expect(carsHiddenFromHolds([car('LUR561', 'HELD')], [hold('LUR561', 'ACTIVE')])).toEqual([]);
  });

  it('a CLEAR car whose holds are all resolved is fine', () => {
    expect(carsHiddenFromHolds([car('MCN136', 'CLEAR')], [hold('MCN136', 'REPAIRED')])).toEqual([]);
  });

  // ⚠️ Narrow on purpose: a sale car's status is decided elsewhere, and a warning that cries wolf
  // is one he learns to ignore.
  it('⚠️ does not flag a sale car or an exception', () => {
    const cars = [car('S1', 'SALE_CAR'), car('E1', 'OUT_ON_EXCEPTION')];
    expect(carsHiddenFromHolds(cars, [hold('S1', 'ACTIVE'), hold('E1', 'ACTIVE')])).toEqual([]);
  });
});
