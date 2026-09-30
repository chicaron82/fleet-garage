import { describe, it, expect } from 'vitest';
import { kindsOfHold, kindPills, vehicleHasKind } from '../../src/lib/holdKinds';
import type { Hold, Vehicle } from '../../src/types';

// docs/ticket-holds-filter-pills.md — the pills are made from the list, not from a fixed set.
const NOW = new Date('2026-09-30T16:00:00Z').getTime();
const car = (id: string) => ({ id, status: 'HELD', licensePlate: id }) as unknown as Vehicle;
const hold = (vehicleId: string, over: Partial<Hold> = {}) => ({
  id: `h-${vehicleId}-${Math.random()}`, vehicleId, status: 'ACTIVE',
  holdTypes: ['damage'], resolvedTypes: [], damageDescription: '', damageZones: [],
  flaggedAt: '2026-09-29T16:00:00Z', ...over,
}) as unknown as Hold;

describe('kindsOfHold', () => {
  it('reads hold types, mechanical sub-types, and the windshield zone', () => {
    expect(kindsOfHold(hold('A', { holdTypes: ['hail'] }))).toEqual(['hail']);
    expect(kindsOfHold(hold('A', { holdTypes: ['mechanical'], mechanicalSubType: 'safety-recall' }))).toEqual(['recall']);
    expect(kindsOfHold(hold('A', { holdTypes: ['mechanical'], mechanicalSubType: 'pm-due' }))).toEqual(['pm']);
    expect(kindsOfHold(hold('A', { holdTypes: ['mechanical'], mechanicalSubType: 'tire-replacement' }))).toEqual(['tires']);
    expect(kindsOfHold(hold('A', { damageZones: ['windshield'] }))).toEqual(['windshield']);
  });

  // Aaron, 2026-09-30: "does it carry several of the other ones?" — 8 of 20 under Damage were windshields.
  it('⭐ a windshield-only damage hold is NOT under Damage — one pile, one pill', () => {
    expect(kindsOfHold(hold('A', { damageZones: ['windshield'], damageDescription: 'Cracked windshield' }))).not.toContain('damage');
    expect(kindsOfHold(hold('A', { damageDescription: 'Windshield chip' }))).not.toContain('damage');
  });

  it('a hold naming the windshield AND a body panel is honestly both', () => {
    expect(kindsOfHold(hold('A', { damageZones: ['windshield', 'hood'] }))).toEqual(['damage', 'windshield']);
  });

  it('⭐ windshield cuts across hail too — it is a LOCATION, not a type', () => {
    expect(kindsOfHold(hold('A', { holdTypes: ['hail'], damageZones: ['windshield', 'hood'] }))).toEqual(['hail', 'windshield']);
  });

  it('a windshield named only in the words still counts', () => {
    expect(kindsOfHold(hold('A', { damageDescription: 'Windshield chip, passenger side' }))).toContain('windshield');
  });

  // ⚠️ A paint chip on a door is not glass. A pill that lies is worse than no pill.
  it('⚠️ "chip" or "crack" alone is NOT a windshield', () => {
    expect(kindsOfHold(hold('A', { damageDescription: 'paint chip driver door' }))).not.toContain('windshield');
    expect(kindsOfHold(hold('A', { damageDescription: 'cracked rear bumper' }))).not.toContain('windshield');
  });

  it('⭐ a type already resolved inside a multi-type hold drops out', () => {
    const h = hold('A', { holdTypes: ['damage', 'mechanical'], resolvedTypes: ['mechanical'], mechanicalSubType: 'pm-due' });
    expect(kindsOfHold(h)).toEqual(['damage']);
  });

  it('a hold that is not ACTIVE carries no kind', () => {
    expect(kindsOfHold(hold('A', { status: 'REPAIRED', holdTypes: ['hail'] }))).toEqual([]);
  });

  it('mechanical "other" and sale cars make no pill', () => {
    expect(kindsOfHold(hold('A', { holdTypes: ['mechanical'], mechanicalSubType: 'other' }))).toEqual([]);
    expect(kindsOfHold(hold('A', { holdTypes: ['sale_car'] }))).toEqual([]);
  });
});

describe('kindPills', () => {
  it('⭐ counts CARS, biggest pile first, and skips kinds with nothing on hold', () => {
    const cars = [car('A'), car('B'), car('C')];
    const holds = [
      hold('A', { holdTypes: ['hail'] }), hold('A', { holdTypes: ['hail'] }), // one car, two hail holds
      hold('B', { holdTypes: ['hail'] }),
      hold('C', { holdTypes: ['mechanical'], mechanicalSubType: 'safety-recall' }),
    ];
    const pills = kindPills(cars, holds, null, NOW);
    expect(pills.map(p => [p.kind, p.count])).toEqual([['hail', 2], ['recall', 1]]);
    expect(pills.some(p => p.kind === 'pm')).toBe(false);
  });

  it('only counts cars in the list it is given', () => {
    const holds = [hold('A', { holdTypes: ['hail'] }), hold('OFF_LIST', { holdTypes: ['hail'] })];
    expect(kindPills([car('A')], holds, null, NOW)[0].count).toBe(1);
  });

  it('⭐ the recall pill knows how long its longest-waiting car has sat', () => {
    const holds = [
      hold('A', { holdTypes: ['mechanical'], mechanicalSubType: 'safety-recall', flaggedAt: '2026-09-16T16:00:00Z' }),
      hold('B', { holdTypes: ['mechanical'], mechanicalSubType: 'safety-recall', flaggedAt: '2026-09-25T16:00:00Z' }),
    ];
    expect(kindPills([car('A'), car('B')], holds, null, NOW)[0]).toMatchObject({ kind: 'recall', count: 2, oldestDays: 14 });
  });

  // ⚠️ Without this, clearing the last car under an active pill empties the list AND removes the only way out.
  it('⚠️ the ACTIVE pill stays at 0 so it can still be turned off', () => {
    const pills = kindPills([car('A')], [hold('A', { holdTypes: ['hail'] })], 'pm', NOW);
    expect(pills.find(p => p.kind === 'pm')).toMatchObject({ count: 0 });
  });

  it('ties keep a fixed order, so the row never shuffles', () => {
    const holds = [hold('A', { holdTypes: ['detail'] }), hold('B', { holdTypes: ['hail'] })];
    expect(kindPills([car('A'), car('B')], holds, null, NOW).map(p => p.kind)).toEqual(['hail', 'detail']);
  });
});

describe('vehicleHasKind', () => {
  it('matches across any of the car\'s active holds', () => {
    const holds = [hold('A', { holdTypes: ['damage'] }), hold('A', { holdTypes: ['mechanical'], mechanicalSubType: 'pm-due' })];
    expect(vehicleHasKind('A', holds, 'pm')).toBe(true);
    expect(vehicleHasKind('A', holds, 'hail')).toBe(false);
  });
});
