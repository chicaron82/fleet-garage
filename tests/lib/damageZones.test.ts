import { describe, it, expect } from 'vitest';
import {
  DAMAGE_ZONES, DAMAGE_ZONE_IDS, isDamageZoneId, zoneLabel, orderZones, toggleZone, summariseZones, vehicleDamageZones,
} from '../../src/lib/damageZones';

describe('the zone catalogue', () => {
  it('has one zone per id, and no duplicates', () => {
    expect(DAMAGE_ZONES).toHaveLength(DAMAGE_ZONE_IDS.length);
    expect(new Set(DAMAGE_ZONES.map(z => z.id)).size).toBe(DAMAGE_ZONES.length);
  });

  it('covers the panels his own hold notes already name', () => {
    // Sampled from live holds 2026-08-22: "Rear driver door ding", "Door ding rear passenger",
    // "Pass. Side Mirror missing cover", "Lift gate dents", "Front bumper", "rear driver side fender".
    // If a note he actually writes has nowhere to land, the catalogue is wrong, not the note.
    for (const id of ['driver-rear-door', 'passenger-rear-door', 'mirror-passenger',
                      'trunk-liftgate', 'front-bumper', 'driver-rear-quarter']) {
      expect(isDamageZoneId(id)).toBe(true);
    }
  });

  it('gives every zone a real drawable box', () => {
    for (const z of DAMAGE_ZONES) {
      expect(z.w).toBeGreaterThan(0);
      expect(z.h).toBeGreaterThan(0);
      expect(z.name.trim()).not.toBe('');
    }
  });
});

describe('isDamageZoneId', () => {
  it('accepts a known id and rejects anything else', () => {
    expect(isDamageZoneId('hood')).toBe(true);
    expect(isDamageZoneId('sunroof')).toBe(false);
    expect(isDamageZoneId('')).toBe(false);
  });
});

describe('zoneLabel', () => {
  it('names a zone the way he says it', () => {
    expect(zoneLabel('trunk-liftgate')).toBe('Trunk / liftgate');
    expect(zoneLabel('mirror-driver')).toBe('Mirror — driver');
  });

  it('⭐ hands an UNKNOWN id back rather than blanking it', () => {
    // A hold tagged by a newer build must still show something. Losing the zone silently is
    // worse than showing a raw id — this is a record whose whole job is not forgetting.
    expect(zoneLabel('tailgate-step')).toBe('tailgate-step');
  });
});

describe('orderZones', () => {
  it('reads nose to tail, not tap order', () => {
    expect(orderZones(['rear-bumper', 'hood', 'front-bumper']))
      .toEqual(['front-bumper', 'hood', 'rear-bumper']);
  });

  it('drops duplicates', () => {
    expect(orderZones(['hood', 'hood'])).toEqual(['hood']);
  });

  it('keeps unknown ids, at the end', () => {
    expect(orderZones(['sunroof', 'hood'])).toEqual(['hood', 'sunroof']);
  });

  it('is empty for empty', () => {
    expect(orderZones([])).toEqual([]);
  });
});

describe('toggleZone', () => {
  it('adds an absent zone and removes a present one', () => {
    expect(toggleZone([], 'hood')).toEqual(['hood']);
    expect(toggleZone(['hood'], 'hood')).toEqual([]);
  });

  it('⭐ normalises on write, so storage never depends on tap order', () => {
    // Two panels, tapped back to front — the row must not remember that.
    const tapped = toggleZone(toggleZone([], 'trunk-liftgate'), 'hood');
    expect(tapped).toEqual(['hood', 'trunk-liftgate']);
  });

  it('leaves the other zones alone', () => {
    expect(toggleZone(['hood', 'rear-bumper'], 'hood')).toEqual(['rear-bumper']);
  });
});

describe('summariseZones', () => {
  it('is empty when nothing is tagged', () => {
    expect(summariseZones([])).toBe('');
  });

  it('names one or two in full', () => {
    expect(summariseZones(['trunk-liftgate'])).toBe('Trunk / liftgate');
    expect(summariseZones(['trunk-liftgate', 'hood'])).toBe('Hood · Trunk / liftgate');
  });

  it('counts the rest past two', () => {
    expect(summariseZones(['hood', 'trunk-liftgate', 'front-bumper', 'roof']))
      .toBe('Front bumper · Hood +2');
  });
});

describe('vehicleDamageZones — what is wrong with this car right now', () => {
  const h = (status: string, zones: string[], flaggedAt = '2026-08-01T00:00:00Z') =>
    ({ status, damageZones: zones, flaggedAt });

  it('merges every standing hold into one set, nose to tail', () => {
    const v = vehicleDamageZones([h('ACTIVE', ['rear-bumper']), h('ACTIVE', ['hood'])]);
    expect(v.zones).toEqual(['hood', 'rear-bumper']);
  });

  it('⭐ a RELEASED pre-existing hold STAYS on the map', () => {
    // "No repair planned — renting as-is": the damage is still on the panel. Clearing these would
    // blank the map on exactly the cars it exists for — approved damage that keeps circulating.
    expect(vehicleDamageZones([h('RELEASED', ['front-bumper'])]).zones).toEqual(['front-bumper']);
  });

  it('a RETURNED hold stays too — the car came back with the damage', () => {
    expect(vehicleDamageZones([h('RETURNED', ['driver-front-door'])]).zones).toEqual(['driver-front-door']);
  });

  it('⭐ REPAIRED clears its panel, with no second action from anyone', () => {
    expect(vehicleDamageZones([h('REPAIRED', ['hood'])]).zones).toEqual([]);
  });

  it('VOIDED clears too — it was never real', () => {
    expect(vehicleDamageZones([h('VOIDED', ['hood'])]).zones).toEqual([]);
  });

  it('one repaired hold does not clear a panel another hold still claims', () => {
    const v = vehicleDamageZones([h('REPAIRED', ['hood']), h('ACTIVE', ['hood', 'roof'])]);
    expect(v.zones).toEqual(['hood', 'roof']);
  });

  it('de-duplicates a panel two standing holds both name', () => {
    expect(vehicleDamageZones([h('ACTIVE', ['hood']), h('RELEASED', ['hood'])]).zones).toEqual(['hood']);
  });

  it('reports the most recent standing flag as "last seen"', () => {
    const v = vehicleDamageZones([
      h('ACTIVE', ['hood'], '2026-07-01T00:00:00Z'),
      h('RELEASED', ['roof'], '2026-08-21T14:17:00Z'),
    ]);
    expect(v.lastFlaggedAt).toBe('2026-08-21T14:17:00Z');
  });

  it('ignores a repaired hold when dating the last flag', () => {
    const v = vehicleDamageZones([
      h('ACTIVE', ['hood'], '2026-07-01T00:00:00Z'),
      h('REPAIRED', ['roof'], '2026-08-21T00:00:00Z'),
    ]);
    expect(v.lastFlaggedAt).toBe('2026-07-01T00:00:00Z');
  });

  it('an untagged hold contributes nothing and does not date the map', () => {
    // Most holds are untagged until the backfill runs — they must not make the map look current.
    const v = vehicleDamageZones([{ status: 'ACTIVE', flaggedAt: '2026-08-22T00:00:00Z' }]);
    expect(v).toEqual({ zones: [], lastFlaggedAt: null });
  });

  it('a car with no holds at all is clear', () => {
    expect(vehicleDamageZones([])).toEqual({ zones: [], lastFlaggedAt: null });
  });
});
