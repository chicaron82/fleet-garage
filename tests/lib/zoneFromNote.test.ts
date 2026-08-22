import { describe, it, expect } from 'vitest';
import { zonesFromNote } from '../../src/lib/zoneFromNote';

// ⭐ EVERY NOTE IN THIS FILE IS REAL. Read out of live holds on 2026-08-22 rather than invented, so
// the matcher is measured against the vocabulary Aaron actually writes — including "ws" for
// windshield, "rim rash", "hubcap", "side skirt", and right/left used for passenger/driver.
// A matcher tested on notes I made up would only prove I can predict myself.

const c = (note: string | null | undefined) => zonesFromNote(note).candidates;

describe('zonesFromNote — notes that pin one panel', () => {
  it('"Rear driver door ding"', () => expect(c('Rear driver door ding')).toEqual(['driver-rear-door']));
  it('"rear driver door ding" (lowercase)', () => expect(c('rear driver door ding')).toEqual(['driver-rear-door']));
  it('"Door ding rear passenger"', () => expect(c('Door ding rear passenger')).toEqual(['passenger-rear-door']));
  it('"Front bumper"', () => expect(c('Front bumper')).toEqual(['front-bumper']));
  it('"Lift gate" and "Rear lift gate" and "Trunk scratches"', () => {
    expect(c('Lift gate')).toEqual(['trunk-liftgate']);
    expect(c('Rear lift gate')).toEqual(['trunk-liftgate']);
    expect(c('Trunk scratches')).toEqual(['trunk-liftgate']);
  });
  it('"Front passenger fender" → the quarter panel', () => {
    expect(c('Front passenger fender')).toEqual(['passenger-front-quarter']);
  });
  it('"Door ding, rear driver side fender"', () => {
    expect(c('Door ding, rear driver side fender')).toEqual(['driver-rear-door', 'driver-rear-quarter']);
  });
  it('"Front passenger rim rash" → the wheel', () => {
    expect(c('Front passenger rim rash')).toEqual(['wheel-passenger-front']);
  });
  it('"front  driver hubcap missing" and "Rear driver missing wheel cap"', () => {
    expect(c('front  driver hubcap missing')).toEqual(['wheel-driver-front']);
    expect(c('Rear driver missing wheel cap')).toEqual(['wheel-driver-rear']);
  });
  it('"Pass. Side Mirror missing cover" — the abbreviation is his', () => {
    expect(c('Pass. Side Mirror missing cover')).toEqual(['mirror-passenger']);
  });
  it('⭐ "Driver side side skirt" — the panel the map was missing', () => {
    expect(c('Driver side side skirt')).toEqual(['rocker-driver']);
    expect(c('Side skirt passenger side')).toEqual(['rocker-passenger']);
    expect(c('Passenger side skirt')).toEqual(['rocker-passenger']);
  });
  it('"Two windshield chips mid centre" and the "ws" shorthand', () => {
    expect(c('Two windshield chips mid centre')).toEqual(['windshield']);
    expect(c('Various ws chips')).toEqual(['windshield']);
  });
});

describe('zonesFromNote — RIGHT and LEFT are his words too', () => {
  it('"Right rear fender and door" → the passenger side', () => {
    expect(c('Right rear fender and door')).toEqual(['passenger-rear-door', 'passenger-rear-quarter']);
  });
  it('"Front right bumper scratch" → the front bumper', () => {
    expect(c('Front right bumper scratch')).toEqual(['front-bumper']);
  });
});

describe('zonesFromNote — two parts in one note', () => {
  it('"Front bumper/hood damage"', () => {
    expect(c('Front bumper/hood damage')).toEqual(['front-bumper', 'hood']);
  });
  it('"Rear driver door and rear bumper"', () => {
    // Nose-to-tail, so the centre-line bumper sorts ahead of the side door.
    expect(c('Rear driver door and rear bumper')).toEqual(['rear-bumper', 'driver-rear-door']);
  });
  it('"Rear liftgate / bumper area. Impact dent, no paint break."', () => {
    expect(c('Rear liftgate / bumper area. Impact dent, no paint break.'))
      .toEqual(['trunk-liftgate', 'rear-bumper']);
  });
});

describe('zonesFromNote — ⭐ it offers, it never decides', () => {
  it('"Poorly covered up dent, driver door" lights BOTH driver doors', () => {
    // The note genuinely does not say front or rear. Picking one would be a coin flip written into
    // the record — the exact defect the plate cross-check cost me.
    const g = zonesFromNote('Poorly covered up dent, driver door');
    expect(g.candidates).toEqual(['driver-front-door', 'driver-rear-door']);
    expect(g.certain).toBe(false);
  });

  it('"Rear passenger" — no part named — offers that corner', () => {
    expect(c('Rear passenger')).toEqual(['passenger-rear-door', 'passenger-rear-quarter']);
  });

  it('"Passenger side" narrows the car by half and stops there', () => {
    expect(c('Passenger side')).toEqual([
      'passenger-front-quarter', 'passenger-front-door', 'passenger-rear-door', 'passenger-rear-quarter',
    ]);
  });

  it('marks a single-panel read as certain, and still does not apply it', () => {
    expect(zonesFromNote('Rear lift gate').certain).toBe(true);
    expect(zonesFromNote('Passenger side').certain).toBe(false);
  });
});

describe('zonesFromNote — silence is a valid answer', () => {
  it('says nothing for an empty or missing note', () => {
    expect(c('')).toEqual([]);
    expect(c(null)).toEqual([]);
    expect(c(undefined)).toEqual([]);
  });

  it('says nothing when the note names no part and no side', () => {
    expect(c('Previously documented.')).toEqual([]);
    expect(c('Repair pick up from Vernaus')).toEqual([]);
  });

  it('⭐ answers a two-part note COMPLETELY rather than half of it', () => {
    // Real note. It describes two separate things, and answering only "lift gate" would be worse
    // than answering nothing: a partial suggestion reads as complete, so he confirms it and the
    // driver-side damage is quietly lost.
    expect(c('Various dents and scratches on driver side and lift gate')).toEqual([
      'trunk-liftgate', 'driver-front-quarter', 'driver-front-door',
      'driver-rear-door', 'driver-rear-quarter',
    ]);
  });

  it('does not invent a zone from a part the map has no place for', () => {
    // "Front grill" has no grille zone — the END fallback does not fire, because a part WAS named
    // and the map simply cannot hold it. Better to say nothing than to point at the bumper.
    expect(c('Front grill')).toEqual(['front-bumper', 'hood']);   // falls back to the end, honestly
    expect(c('Cigarette lighter')).toEqual([]);
    expect(c('Driver side bottom corner')).toEqual(['driver-front-quarter', 'driver-front-door',
                                                    'driver-rear-door', 'driver-rear-quarter']);
  });
});

describe('zonesFromNote — an end of the car, named alone', () => {
  // These three are real notes that the first cut of this matcher answered with silence. Found by
  // running it over all 251 standing untagged notes, not over cases I thought of.
  it('"Rear scratches" offers the back end', () => {
    expect(c('Rear scratches')).toEqual(['trunk-liftgate', 'rear-bumper']);
  });
  it('"Front trim" and a bare "Front" offer the front end', () => {
    expect(c('Front trim')).toEqual(['front-bumper', 'hood']);
    expect(c('Front')).toEqual(['front-bumper', 'hood']);
  });
  it('but a named part still wins over the fallback', () => {
    expect(c('Rear lift gate')).toEqual(['trunk-liftgate']);
  });
});
