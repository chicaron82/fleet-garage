import { describe, it, expect } from 'vitest';
import {
  DAMAGE_ZONES, DAMAGE_ZONE_IDS, isDamageZoneId, zoneLabel, orderZones, toggleZone, summariseZones,
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
