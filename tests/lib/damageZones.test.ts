import { describe, it, expect } from 'vitest';
import {
  DAMAGE_ZONES,
  DAMAGE_ZONE_IDS,
  holdIsMappable,
  isDamageZoneId,
  orderZones,
  presetFor,
  summariseZones,
  toggleZone,
  type QueueHold,
  vehicleDamageZones,
  zoneBackfillQueue,
  zoneEvidence,
  zoneLabel,
  zonesSetAside,
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

describe('zoneBackfillQueue', () => {
  // vehicleId defaults to the hold's own id, so each fixture is its own car unless a test says
  // otherwise — the grouping behaviour then has to be asked for explicitly to show up.
  const q = (over: Partial<QueueHold> & { id: string }): QueueHold =>
    ({ vehicleId: over.id, holdTypes: ['damage'], status: 'ACTIVE', notes: '', flaggedAt: '2026-08-01T00:00:00Z', ...over });
  const rankByHelp = (h: QueueHold) => (h.notes.includes('lift gate') ? 0 : h.notes ? 1 : 2);

  it('⭐ leaves out repaired and voided holds entirely', () => {
    // Their panels never render anywhere, so tagging them is archaeology with no payoff.
    const out = zoneBackfillQueue([
      q({ id: 'a', status: 'REPAIRED' }), q({ id: 'b', status: 'VOIDED' }), q({ id: 'c' }),
    ], () => 0);
    expect(out.map(h => h.id)).toEqual(['c']);
  });

  it('keeps active, released and returned — the damage is still on those cars', () => {
    const out = zoneBackfillQueue([
      q({ id: 'a', status: 'ACTIVE' }), q({ id: 'b', status: 'RELEASED' }), q({ id: 'c', status: 'RETURNED' }),
    ], () => 0);
    expect(out).toHaveLength(3);
  });

  it('leaves out holds that are already tagged', () => {
    const out = zoneBackfillQueue([q({ id: 'a', damageZones: ['hood'] }), q({ id: 'b' })], () => 0);
    expect(out.map(h => h.id)).toEqual(['b']);
  });

  it('⭐ puts the notes the matcher can read first, so the grind opens fast', () => {
    const out = zoneBackfillQueue([
      q({ id: 'blank' }),
      q({ id: 'vague', notes: 'Passenger side' }),
      q({ id: 'pinned', notes: 'Rear lift gate' }),
    ], rankByHelp);
    expect(out.map(h => h.id)).toEqual(['pinned', 'vague', 'blank']);
  });

  it('breaks ties newest first', () => {
    const out = zoneBackfillQueue([
      q({ id: 'older', flaggedAt: '2026-01-01T00:00:00Z' }),
      q({ id: 'newer', flaggedAt: '2026-08-20T00:00:00Z' }),
    ], () => 0);
    expect(out.map(h => h.id)).toEqual(['newer', 'older']);
  });

  it('⭐ leaves out holds where a panel is not a meaningful answer', () => {
    // 83 of the 92 remaining were like this: a safety recall does not sit on a quarter panel, and a
    // car flagged for auction is not damage at all. Not "he cannot tell" — the question does not apply.
    const out = zoneBackfillQueue([
      q({ id: 'mech', holdTypes: ['mechanical'] }),
      q({ id: 'sale', holdTypes: ['sale_car'] }),
      q({ id: 'acc', holdTypes: ['missing_accessories'] }),
      q({ id: 'detail', holdTypes: ['detail'] }),
      q({ id: 'dmg', holdTypes: ['damage'] }),
      q({ id: 'hail', holdTypes: ['hail'] }),
    ], () => 0);
    expect(out.map(h => h.id).sort()).toEqual(['dmg', 'hail']);
  });

  it('keeps a hold that is damage AND something else', () => {
    const out = zoneBackfillQueue([q({ id: 'both', holdTypes: ['mechanical', 'damage'] })], () => 0);
    expect(out.map(h => h.id)).toEqual(['both']);
  });

  it('is empty when there is nothing left to tag', () => {
    expect(zoneBackfillQueue([q({ id: 'a', damageZones: ['hood'] })], () => 0)).toEqual([]);
  });

  it('⭐ keeps ONE CAR\'s holds together, however they rank', () => {
    // The queue counts holds; he experiences cars. A car with two damage records coming round a
    // second time reads as "my tag didn't save" — 30 of the 132 remaining holds were exactly that.
    const out = zoneBackfillQueue([
      q({ id: 'car1-a', vehicleId: 'car1', notes: 'Rear lift gate' }),
      q({ id: 'car2-a', vehicleId: 'car2', notes: 'Rear lift gate' }),
      q({ id: 'car1-b', vehicleId: 'car1', notes: '' }),          // blank note, ranks last
    ], rankByHelp);
    expect(out.map(h => h.id)).toEqual(['car1-a', 'car1-b', 'car2-a']);
  });

  it('a car still inherits its BEST hold\'s rank, so easy cars open the run', () => {
    // car2's only hold is readable; car1's readable hold drags its blank sibling along behind it.
    const out = zoneBackfillQueue([
      q({ id: 'blank-car', vehicleId: 'carX', notes: '' }),
      q({ id: 'good', vehicleId: 'carY', notes: 'Rear lift gate' }),
      q({ id: 'goods-sibling', vehicleId: 'carY', notes: '' }),
    ], rankByHelp);
    expect(out.map(h => h.id)).toEqual(['good', 'goods-sibling', 'blank-car']);
  });
});

describe('presetFor', () => {
  it('offers the top surfaces for a hail hold — hail falls downward', () => {
    expect(presetFor(['hail'])).toEqual({ label: 'Hail — hood, roof, trunk',
                                          zones: ['hood', 'roof', 'trunk-liftgate'] });
  });

  it('finds hail among several types on one hold', () => {
    expect(presetFor(['damage', 'hail'])?.zones).toEqual(['hood', 'roof', 'trunk-liftgate']);
  });

  it('offers nothing for damage that has no characteristic shape', () => {
    expect(presetFor(['damage'])).toBeNull();
    expect(presetFor(['mechanical', 'detail'])).toBeNull();
    expect(presetFor([])).toBeNull();
    expect(presetFor(undefined)).toBeNull();
  });

  it('⭐ hands back a fresh array each time', () => {
    // The caller drops it straight into a draft and then toggles panels off it; a shared array
    // would let one hold's edits rewrite the preset for every hold after it.
    const a = presetFor(['hail'])!.zones;
    a.push('roof');
    expect(presetFor(['hail'])!.zones).toEqual(['hood', 'roof', 'trunk-liftgate']);
  });
});

describe('zoneBackfillQueue — what never belonged in the list', () => {
  const q2 = (over: Partial<QueueHold> & { id: string }): QueueHold =>
    ({ vehicleId: over.id, holdTypes: ['damage'], status: 'ACTIVE', notes: '',
       flaggedAt: '2026-08-01T00:00:00Z', unitNumber: '5421011', ...over });

  it('⭐ leaves out FG\'s own mock rows', () => {
    // GHK 294 / KLP 447 were sitting in the queue with novelistic seed descriptions. The HRZ-
    // unit prefix is the fact; mocks belong in no worklist.
    const out = zoneBackfillQueue([
      q2({ id: 'mock', unitNumber: 'HRZ-4821' }),
      q2({ id: 'real', unitNumber: '5421557' }),
    ], () => 0);
    expect(out.map(h => h.id)).toEqual(['real']);
  });

  it('⭐ leaves out a picklist fault the paper slip records in NOTES, not on its diagram', () => {
    // "i don't need zones for them as they don't exist on the manual sheet." A missing cigarette
    // lighter is a real fault with no body location, because nothing on the body happened.
    const out = zoneBackfillQueue([
      q2({ id: 'lighter', damageDescription: 'Missing part / accessory' }),
      q2({ id: 'scratch', damageDescription: 'Scratch — paint surface' }),
    ], () => 0);
    expect(out.map(h => h.id)).toEqual(['scratch']);
  });

  it('⭐ KEEPS a hand-typed fault no rule can safely classify', () => {
    // "rear camera" and "Trunk bed liner damaged" are the same kind of fault, typed free-hand.
    // No string can rule them out, so they stay counted — and that count is TRUE. The record is
    // complete either way; only the at-a-glance map cannot draw them.
    const out = zoneBackfillQueue([q2({ id: 'camera', damageDescription: 'rear camera' })], () => 0);
    expect(out.map(h => h.id)).toEqual(['camera']);
  });

  it('does not choke on a hold with no unit number or description', () => {
    const out = zoneBackfillQueue([q2({ id: 'bare', unitNumber: null, damageDescription: undefined })], () => 0);
    expect(out.map(h => h.id)).toEqual(['bare']);
  });
});

// ── "No panel applies" — the answer, not a dismissal (migrations/125) ─────────
describe('zonesReviewedAt — holds a human has set aside', () => {
  const q = (over: Partial<QueueHold> & { id: string }): QueueHold =>
    ({ vehicleId: over.id, holdTypes: ['damage'], status: 'ACTIVE', notes: '', flaggedAt: '2026-08-01T00:00:00Z', ...over });
  const REVIEWED = '2026-08-24T15:00:00Z';

  it('⭐ stops asking about a hold whose question has been answered', () => {
    // The real pair (2026-08-24): a rear camera lens proud of its housing and a trunk bed liner
    // eaten by a chemical spill. Real damage, photographed, nowhere on the body diagram — so they
    // came back to the top of a finite queue forever and made "nothing left to tag" a lie.
    const out = zoneBackfillQueue([
      q({ id: 'lens',   notes: 'lense for rear camera slightly off', zonesReviewedAt: REVIEWED }),
      q({ id: 'liner',  notes: 'bed liner eaten by chemical spill',  zonesReviewedAt: REVIEWED }),
      q({ id: 'bumper', notes: 'front bumper scrape' }),
    ], () => 0);
    expect(out.map(h => h.id)).toEqual(['bumper']);
  });

  it('⚠️ counts them instead of hiding them — nothing vanishes behind a tap', () => {
    // The objection this design had to earn its way past. A set-aside hold leaves the QUEUE and
    // stays visible in the total, so a real damage hold can never be silently swallowed.
    const holds = [
      q({ id: 'lens',   zonesReviewedAt: REVIEWED }),
      q({ id: 'bumper' }),
    ];
    expect(zoneBackfillQueue(holds, () => 0).map(h => h.id)).toEqual(['bumper']);
    expect(zonesSetAside(holds).map(h => h.id)).toEqual(['lens']);
  });

  it('clearing it puts the hold straight back in the queue', () => {
    // A tap made in error must be as cheap to undo as it was to make.
    const back = q({ id: 'lens', zonesReviewedAt: null });
    expect(zoneBackfillQueue([back], () => 0).map(h => h.id)).toEqual(['lens']);
    expect(zonesSetAside([back])).toEqual([]);
  });

  it('a hold that was set aside and LATER tagged is in neither list', () => {
    // Zones win: it has an answer now, so it is neither outstanding nor set aside.
    const tagged = q({ id: 'lens', zonesReviewedAt: REVIEWED, damageZones: ['front-bumper'] });
    expect(zoneBackfillQueue([tagged], () => 0)).toEqual([]);
    expect(zonesSetAside([tagged])).toEqual([]);
  });

  it('does not count things that were never in the queue to begin with', () => {
    // Set-aside is only meaningful for a hold the queue WOULD have asked about. A repaired hold, a
    // mock row, a mechanical hold and a picklist line with no diagram entry were already excluded —
    // counting them would inflate the number and make it noise.
    expect(zonesSetAside([
      q({ id: 'repaired',   status: 'REPAIRED', zonesReviewedAt: REVIEWED }),
      q({ id: 'mock',       unitNumber: 'HRZ-4821', zonesReviewedAt: REVIEWED }),
      q({ id: 'mechanical', holdTypes: ['mechanical'], zonesReviewedAt: REVIEWED }),
      q({ id: 'accessory',  damageDescription: 'Missing part / accessory', zonesReviewedAt: REVIEWED }),
    ])).toEqual([]);
  });
});

// ── holdIsMappable ────────────────────────────────────────────────────────────
// ⭐ ONE predicate, two callers. The backfill queue and the new-hold form both have to decide
// whether a hold has somewhere on the car to point at, and if they ever answer differently a hold
// could have its zones collected at flag time and STILL enqueue — or be dropped by each on the
// other's assumption. Exported for exactly that reason (2026-08-24).
describe('holdIsMappable — does this hold have a place on the diagram?', () => {
  it('body damage and hail are mappable', () => {
    expect(holdIsMappable(['damage'], 'Scratch — paint surface')).toBe(true);
    expect(holdIsMappable(['hail'], 'Hail damage')).toBe(true);
  });

  it('a hold with no mappable type is not', () => {
    expect(holdIsMappable(['detail'], 'Interior detail')).toBe(false);
    expect(holdIsMappable(['mechanical'], 'Check engine light')).toBe(false);
    expect(holdIsMappable(['sale_car'], 'Sale car')).toBe(false);
  });

  it('⭐ a missing part is a real fault with NO body location', () => {
    // Aaron's paper-slip rule: the map mirrors the DIAGRAM on Vehicle Inspection #9000501, and a
    // missing cigarette lighter never gets circled because nothing on the body happened.
    expect(holdIsMappable(['damage'], 'Missing part / accessory')).toBe(false);
  });

  it('a mixed hold keeps its map — one of its faults still has a panel', () => {
    expect(holdIsMappable(['damage', 'mechanical'], 'Dent — panel')).toBe(true);
  });

  it('missing or empty inputs are not mappable rather than throwing', () => {
    expect(holdIsMappable(undefined, 'Scratch')).toBe(false);
    expect(holdIsMappable([], 'Scratch')).toBe(false);
    expect(holdIsMappable(['damage'], null)).toBe(true);
    expect(holdIsMappable(['damage'], undefined)).toBe(true);
  });
});


// ── zoneEvidence — the WHICH the map never answered ───────────────────────────────────────────
// Aaron, 2026-08-25: "i could tap the zone and it would show me the photo of the damage at that
// zone." The join was already on the row — `damage_zones` and `photos` are columns on the same
// hold — so this stores nothing new and cannot drift from the map beside it.
describe('zoneEvidence — what is actually on that panel', () => {
  const h = (
    id: string, status: string, zones: string[], photos: string[] = [],
    damageDescription = 'Scratch', flaggedAt = '2026-08-01T00:00:00Z',
  ) => ({ id, status, damageZones: zones, photos, damageDescription, flaggedAt });

  it('indexes a hold under the panel it sits on, with its photos', () => {
    const e = zoneEvidence([h('a', 'ACTIVE', ['hood'], ['p1.jpg', 'p2.jpg'])]);
    expect(e.hood).toHaveLength(1);
    expect(e.hood[0]).toMatchObject({ holdId: 'a', photos: ['p1.jpg', 'p2.jpg'] });
  });

  // ⭐ A hold spanning three panels is ONE damage event, and every photo of it is a photo of that
  // event — so it appears under each panel in full rather than being split or picked between.
  it('a multi-zone hold appears under every panel it covers', () => {
    const e = zoneEvidence([h('a', 'ACTIVE', ['hood', 'front-bumper'], ['p1.jpg'])]);
    expect(e.hood[0].holdId).toBe('a');
    expect(e['front-bumper'][0].holdId).toBe('a');
  });

  // ⚠️⚠️ THE LUR184 CASE, and the reason this feature exists. Three holds on one car all described
  // "Windshield chip"; the picker showed that shared field and hid the two that differed, and a
  // live bumper scratch got marked repaired. Both holds on a contested panel must come back — the
  // moment this picks one for him, it has rebuilt the defect.
  it('returns EVERY hold on a contested panel, never picks one', () => {
    const e = zoneEvidence([
      h('old', 'ACTIVE', ['rear-bumper'], ['old.jpg'], 'Windshield chip', '2026-07-01T00:00:00Z'),
      h('new', 'ACTIVE', ['rear-bumper'], ['new.jpg'], 'Windshield chip', '2026-08-01T00:00:00Z'),
    ]);
    expect(e['rear-bumper'].map(x => x.holdId)).toEqual(['new', 'old']);   // newest first
  });

  // ⭐ ONE PREDICATE with vehicleDamageZones, or the map paints a panel the inspector calls empty.
  it('clears a panel exactly when the map does — REPAIRED and VOIDED, and nothing else', () => {
    for (const status of ['REPAIRED', 'VOIDED']) {
      const holds = [h('a', status, ['hood'], ['p.jpg'])];
      expect(vehicleDamageZones(holds).zones).toEqual([]);
      expect(zoneEvidence(holds).hood).toBeUndefined();
    }
    for (const status of ['ACTIVE', 'RELEASED', 'RETURNED']) {
      const holds = [h('a', status, ['hood'], ['p.jpg'])];
      expect(vehicleDamageZones(holds).zones).toEqual(['hood']);
      expect(zoneEvidence(holds).hood).toHaveLength(1);
    }
  });

  // ⚠️ Every panel the map paints MUST have evidence, on any input — that equivalence is what makes
  // an unpainted panel safe to leave inert and a painted one safe to make tappable.
  it('painted and explained are the same set', () => {
    const holds = [
      h('a', 'ACTIVE', ['hood'], ['p.jpg']),
      h('b', 'REPAIRED', ['roof'], ['q.jpg']),
      h('c', 'RELEASED', ['rear-bumper'], []),
      h('d', 'ACTIVE', [], ['r.jpg']),
    ];
    expect(Object.keys(zoneEvidence(holds)).sort()).toEqual([...vehicleDamageZones(holds).zones].sort());
  });

  it('a zoned hold with no photos still reports — the description is the discriminator', () => {
    const e = zoneEvidence([h('a', 'ACTIVE', ['roof'], [], 'Hail dents')]);
    expect(e.roof[0]).toMatchObject({ photos: [], damageDescription: 'Hail dents' });
  });

  it('a hold with photos but no zone is unreachable from the map, and says so by absence', () => {
    expect(zoneEvidence([h('a', 'ACTIVE', [], ['p.jpg'])])).toEqual({});
  });
});
