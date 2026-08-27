import { describe, it, expect } from 'vitest';
import {
  INTERIOR_ZONES, INTERIOR_ZONE_IDS, THIRD_ROW_ZONE_ID,
  interiorZonesFor, thirdRowTaggedIn, CABIN_OUTLINE,
} from '../../src/lib/interiorZones';
import { DAMAGE_ZONE_IDS, zoneLabel, isDamageZoneId, orderZones, summariseZones, CAR_OUTLINE } from '../../src/lib/damageZones';

describe('the interior zone set', () => {
  it('covers every case Aaron brought', () => {
    // A missing cigarette lighter, a missing rear headrest (passenger side), a chewed bedliner,
    // a rear-driver buckle that would not retract.
    for (const id of ['centre-console', 'seat-second-passenger', 'cargo-area', 'seat-second-driver']) {
      expect(INTERIOR_ZONE_IDS).toContain(id);
    }
  });

  it('splits the second row into three positions', () => {
    // ⚠️ Both real cases were position-specific. One "rear seats" zone would push the position back
    // into the note, rebuilding the thing this replaces.
    expect(INTERIOR_ZONE_IDS).toEqual(expect.arrayContaining(
      ['seat-second-driver', 'seat-second-centre', 'seat-second-passenger']));
  });

  it('keeps the third row as ONE bench, not per-seat', () => {
    // "it could be 3 seats or could be 2" — the photo settles which. Coarse on purpose.
    const third = INTERIOR_ZONE_IDS.filter(id => id.includes('third'));
    expect(third).toEqual([THIRD_ROW_ZONE_ID]);
  });

  // ⚠️⚠️ THE COLLISION THAT WOULD HAVE MADE A TAG AMBIGUOUS. The exterior map already owns
  // `trunk-liftgate` — the LID. The cargo area is the inside. Two ids, two meanings, never merged.
  it('does not collide with any exterior id', () => {
    const exterior = new Set<string>(DAMAGE_ZONE_IDS);
    for (const id of INTERIOR_ZONE_IDS) expect(exterior.has(id)).toBe(false);
    expect(exterior.has('trunk-liftgate')).toBe(true);
    expect(INTERIOR_ZONE_IDS).toContain('cargo-area');
  });

  it('names positions driver/passenger, matching the exterior map', () => {
    // One car, one language — never left/right on one map and driver/passenger on the other.
    const names = INTERIOR_ZONES.map(z => z.name).join(' ');
    expect(names).not.toMatch(/\bleft\b|\bright\b/i);
    expect(names).toMatch(/driver/);
    expect(names).toMatch(/passenger/);
  });

  it('shares the exterior canvas so the views swap without resizing', () => {
    expect(CABIN_OUTLINE.viewBox).toBe(CAR_OUTLINE.viewBox);
  });

  it('gives every zone a real hit box', () => {
    for (const z of INTERIOR_ZONES) {
      expect(z.w).toBeGreaterThan(0);
      expect(z.h).toBeGreaterThan(0);
      expect(z.name.trim()).not.toBe('');
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(INTERIOR_ZONE_IDS).size).toBe(INTERIOR_ZONE_IDS.length);
  });
});

describe('the third-row toggle', () => {
  it('hides the bench when the car has no third row', () => {
    const ids = interiorZonesFor(false).map(z => z.id);
    expect(ids).not.toContain(THIRD_ROW_ZONE_ID);
    expect(ids).toContain('seat-second-centre');
  });

  it('shows it when toggled on', () => {
    expect(interiorZonesFor(true).map(z => z.id)).toContain(THIRD_ROW_ZONE_ID);
  });

  // ⭐⭐ Derived from the TAGS, never from a guess about the car. A hold already tagged on the third
  // row must render that tag — defaulting the toggle off would HIDE an existing record, which is the
  // vanishing-correction-path defect wearing a new outfit.
  it('starts ON when the hold already has a third-row tag', () => {
    expect(thirdRowTaggedIn(['seat-second-driver', THIRD_ROW_ZONE_ID])).toBe(true);
    expect(thirdRowTaggedIn(['seat-second-driver'])).toBe(false);
    expect(thirdRowTaggedIn([])).toBe(false);
  });
});

// ⭐⭐⭐ ONE VOCABULARY. A hold stores a single array and a car can be dented AND missing a headrest,
// so every existing reader has to speak both sets. These would all have failed before the merge.
describe('interior ids work everywhere exterior ids do', () => {
  it('labels an interior id instead of echoing the raw slug', () => {
    expect(zoneLabel('seat-second-passenger')).toBe('2nd row — passenger');
    expect(zoneLabel('cargo-area')).toBe('Cargo area');
  });

  it('recognises an interior id as known', () => {
    expect(isDamageZoneId('head-unit')).toBe(true);
    expect(isDamageZoneId('glovebox')).toBe(false);   // plausible, not a zone — must stay false
  });

  it('orders a mixed set without dropping either side', () => {
    const mixed = orderZones(['cargo-area', 'hood', 'seat-front-driver']);
    expect(mixed).toHaveLength(3);
    expect(mixed[0]).toBe('hood');                    // exterior first, nose to tail
  });

  it('summarises a mixed set in words, not slugs', () => {
    expect(summariseZones(['hood', 'seat-second-passenger'])).toBe('Hood · 2nd row — passenger');
  });
});

// ⚠️ THE GEOMETRY I CANNOT EYEBALL. I could not get a screenshot of the cabin map — the backfill
// screen is not URL-addressable and the record's "Add" collides with "Add hold" in the click helper
// — so the layout risks that a picture would have caught get asserted instead. Overlapping rects
// would silently steal each other's taps, and a zone outside the shell would render orphaned.
describe('cabin layout', () => {
  const overlaps = (a: typeof INTERIOR_ZONES[number], b: typeof INTERIOR_ZONES[number]) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('has no two zones overlapping — an overlap steals taps', () => {
    const clashes: string[] = [];
    for (let i = 0; i < INTERIOR_ZONES.length; i++) {
      for (let j = i + 1; j < INTERIOR_ZONES.length; j++) {
        if (overlaps(INTERIOR_ZONES[i], INTERIOR_ZONES[j])) {
          clashes.push(`${INTERIOR_ZONES[i].id} ↔ ${INTERIOR_ZONES[j].id}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('keeps every zone inside the cabin shell', () => {
    const s = CABIN_OUTLINE.shells[0];
    for (const z of INTERIOR_ZONES) {
      expect(z.x).toBeGreaterThanOrEqual(s.x);
      expect(z.y).toBeGreaterThanOrEqual(s.y);
      expect(z.x + z.w).toBeLessThanOrEqual(s.x + s.w);
      expect(z.y + z.h).toBeLessThanOrEqual(s.y + s.h);
    }
  });

  it('gives every zone a thumb-sized hit box', () => {
    // Gloves on, on a phone. The exterior map's smallest real target (a mirror) is 40x26.
    for (const z of INTERIOR_ZONES) {
      expect(z.w * z.h).toBeGreaterThanOrEqual(40 * 26);
    }
  });

  it('puts the passenger side and driver side on the same halves as the exterior map', () => {
    // The shared FRONT / PASSENGER SIDE / DRIVER SIDE labels are drawn once for both views, so the
    // cabin must agree with them or the labels become lies.
    const p = INTERIOR_ZONES.find(z => z.id === 'seat-front-passenger')!;
    const d = INTERIOR_ZONES.find(z => z.id === 'seat-front-driver')!;
    expect(p.y).toBeLessThan(d.y);          // passenger up top, as on the exterior map
    const front = INTERIOR_ZONES.find(z => z.id === 'head-unit')!;
    const back = INTERIOR_ZONES.find(z => z.id === 'cargo-area')!;
    expect(front.x).toBeLessThan(back.x);   // front on the left
  });
});
