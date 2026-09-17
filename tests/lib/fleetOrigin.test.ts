/**
 * Fleet by origin — every fixture here is a real car from the night the card was designed
 * (2026-09-16/17), and each test is one of Aaron's rulings.
 */
import { describe, expect, it } from 'vitest';
import { fleetOrigin, isManitobaFleetPlate, type OriginVehicle } from '../../src/lib/fleetOrigin';
import { owningCity } from '../../api/_lib/owningArea';

let n = 0;
const car = (licensePlate: string, owningArea: string | null, over: Partial<OriginVehicle> = {}): OriginVehicle =>
  ({ id: `v${++n}`, licensePlate, owningArea, make: 'Nissan', rentalClass: 'B5', unitNumber: `54${n}`, ...over });

describe('owningCity', () => {
  it('folds older and newer numbers into one city — "winnipeg 8199 and winnipeg 8999 are still winnipeg"', () => {
    expect(owningCity('8199')).toBe('Winnipeg');
    expect(owningCity('08999')).toBe('Winnipeg');
    expect(owningCity('8191')).toBe('Vancouver');
    expect(owningCity('8890')).toBe('Vancouver');   // Vancouver's OLDER number, not "DTG"
  });
  it('never names a branch he has not confirmed', () => {
    expect(owningCity('1198')).toBeNull();
    expect(owningCity('')).toBeNull();
  });
});

describe('isManitobaFleetPlate', () => {
  it('⚠️ Halifax wears the same AAA999 SHAPE — only the known fleet prefixes count', () => {
    expect(isManitobaFleetPlate('LUR270')).toBe(true);
    expect(isManitobaFleetPlate('HMT717')).toBe(false);   // Halifax, same shape
    expect(isManitobaFleetPlate('HFE872')).toBe(false);
  });
});

describe('fleetOrigin', () => {
  it('local is the COMPOUND test — MB plate AND Winnipeg owning', () => {
    const o = fleetOrigin([car('LUR270', '8199'), car('KUR261', '8999'), car('0ES919', '8193')]);
    expect(o.local).toBe(2);
    expect(o.foreignOwned).toBe(1);
  });

  it('⭐ converted HERE splits by his two reasons — Tesla batch vs low-km one-ways', () => {
    const o = fleetOrigin([
      car('LJF685', '8890', { make: 'Tesla', rentalClass: 'E8' }),
      car('MCM560', '8193', { make: 'Chevrolet', model: 'Suburban' }),
      car('LUR431', '8191'),
    ]);
    expect(o.convertedHere.teslas.map(v => v.licensePlate)).toEqual(['LJF685']);
    expect(o.convertedHere.oneWays.map(v => v.licensePlate)).toEqual(['LUR431', 'MCM560']);
    expect(o.local).toBe(0);
  });

  it('⭐ converted AWAY — XT193P, ours, went to Vancouver and came back on BC plates', () => {
    const o = fleetOrigin([car('XT193P', '8199', { model: 'Rogue' })]);
    expect(o.convertedAway.map(v => v.licensePlate)).toEqual(['XT193P']);
    expect(o.local).toBe(0);
    expect(o.foreignOwned).toBe(0);
  });

  it('a car with no owning area is UNKNOWN, never guessed into a bucket', () => {
    const o = fleetOrigin([car('FTJ2508', null)]);
    expect(o.unknown.map(v => v.licensePlate)).toEqual(['FTJ2508']);
    expect(o.cities).toEqual([]);
  });

  it('cities merge their codes, commonest first, and count MB-plated cars', () => {
    const o = fleetOrigin([
      car('XF337E', '8191'), car('XN559J', '8191'),
      car('LJF681', '8890', { make: 'Tesla' }),
    ]);
    const van = o.cities.find(c => c.city === 'Vancouver')!;
    expect(van.count).toBe(3);
    expect(van.codes).toEqual(['8191', '8890']);
    expect(van.mbPlated).toBe(1);
  });

  it('an unnamed US branch groups as "US", not as a guessed city', () => {
    const o = fleetOrigin([car('SSDY46', '1198', { isUs: true }), car('SPHV03', '2294', { isUs: true })]);
    expect(o.cities.map(c => [c.city, c.count])).toEqual([['US', 2]]);
  });

  it('a car with no rental class is counted as "no class", never dropped', () => {
    const o = fleetOrigin([car('LUR100', '8199', { rentalClass: null })]);
    expect(o.cities[0]!.classes).toEqual([['no class', 1]]);
  });

  it('archived and HRZ- mock cars are not the fleet', () => {
    const o = fleetOrigin([
      car('LUR270', '8199', { archivedAt: '2026-09-17T00:00:00Z' }),
      car('LUR486', '8199', { unitNumber: 'HRZ-3307' }),
      car('LUR271', '8199'),
    ]);
    expect(o.live).toBe(1);
  });

  it('every live car lands in exactly one bucket', () => {
    const fleet = [
      car('LUR270', '8199'), car('0ES919', '8193'), car('LJF685', '8890', { make: 'Tesla' }),
      car('MCM560', '8193'), car('XT193P', '8199'), car('FTJ2508', null),
    ];
    const o = fleetOrigin(fleet);
    const total = o.local + o.foreignOwned + o.convertedHere.teslas.length + o.convertedHere.oneWays.length
      + o.convertedAway.length + o.unknown.length;
    expect(total).toBe(o.live);
  });
});
