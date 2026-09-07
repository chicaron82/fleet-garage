import { describe, it, expect } from 'vitest';
import { vehicleLabel, powertrainBadge, type NamedVehicle, vehicleNameText, identityGaps, describeIdentityGaps } from '../../src/lib/vehicleName';

const car = (over: Partial<NamedVehicle> = {}): NamedVehicle =>
  ({ year: 2026, make: 'Toyota', model: 'RAV4', ...over });

describe('vehicleLabel', () => {
  it('leads with the year, the way seven of eight surfaces render it', () => {
    expect(vehicleLabel(car())).toBe('2026 Toyota RAV4');
  });

  // FleetMasterView's column leads with the model — the one surface that differs, kept rather than
  // homogenised, because its layout is doing something the others aren't.
  it('leads with the model when asked', () => {
    expect(vehicleLabel(car(), 'model-first')).toBe('Toyota RAV4 2026');
  });

  it('collapses the gap a blank field would leave', () => {
    expect(vehicleLabel(car({ make: '' }))).toBe('2026 RAV4');
  });
});

describe('powertrainBadge — ⚡ is what it RUNS ON, not what it needs checked', () => {
  it('⚡ for a Tesla', () => {
    expect(powertrainBadge(car({ make: 'Tesla', model: 'Model 3', isTesla: true }))).toBe('⚡');
  });

  // ⭐ The correction that made this cheap: `CKNE → { model: 'Niro EV', isEv: true }` was already in
  // the codex and the airport flip already read it. No column, no migration — FG knew all along.
  it('⚡ for a non-Tesla EV, derived from the model the codex marks', () => {
    expect(powertrainBadge(car({ make: 'Kia', model: 'Niro EV' }))).toBe('⚡');
    expect(powertrainBadge(car({ make: 'Kia', model: 'niro ev' }))).toBe('⚡');
  });

  it('🔋 for a hybrid', () => {
    expect(powertrainBadge(car({ isHybrid: true }))).toBe('🔋');
  });

  // 645 of 711 cars carry no badge. That silence is what makes the 66 that do worth looking at.
  it('nothing at all for an ordinary petrol car', () => {
    expect(powertrainBadge(car())).toBeNull();
    expect(powertrainBadge(car({ isHybrid: false, isTesla: false }))).toBeNull();
  });

  it('⚡ wins if a record somehow claims both', () => {
    expect(powertrainBadge(car({ isTesla: true, isHybrid: true }))).toBe('⚡');
  });

  // ⚠️ A Niro that is NOT the EV must not borrow the badge off a substring.
  it('does not badge a model that merely resembles an EV one', () => {
    expect(powertrainBadge(car({ make: 'Kia', model: 'Niro' }))).toBeNull();
    expect(powertrainBadge(car({ make: 'Kia', model: 'Niro EV Special' }))).toBeNull();
  });
});

// ── vehicleNameText: the string half, and the nullable parts ─────────────────────────────────
//
// ⭐ Added 2026-09-01 with the sweep that finally converted the callers `VehicleName` was written
// for. The component can only go where JSX goes — a toast, a push notification, a driver's transit
// line are plain strings, so each one hand-wrote the name and silently lost the badge.
describe('vehicleNameText', () => {
  const civic = { year: 2026, make: 'Honda', model: 'Civic', isHybrid: true };

  it('carries the badge the component shows', () => {
    expect(vehicleNameText(civic)).toBe('2026 Honda Civic 🔋');
  });

  it('says nothing extra for a plain petrol car', () => {
    expect(vehicleNameText({ ...civic, isHybrid: false })).toBe('2026 Honda Civic');
  });

  it('agrees with the component on an EV', () => {
    const t = { year: 2024, make: 'Tesla', model: 'Model Y', isTesla: true };
    expect(vehicleNameText(t)).toBe(`${vehicleLabel(t)} ${powertrainBadge(t)}`);
  });

  it('follows the order it is given', () => {
    expect(vehicleNameText(civic, 'model-first')).toBe('Honda Civic 2026 🔋');
  });
});

// ⚠️ The helper has to be at LEAST as careful as the hand-written code it replaced. Those sites did
// `[year, make, model].filter(Boolean).join(' ')`, which drops a missing part — and `KnownPlate`
// (the plate-entry resolver) genuinely carries nulls. A template would have written the literal
// "null" into a lost-item record. A consolidation that loses a behaviour is a downgrade with
// better provenance.
describe('vehicleLabel with parts missing', () => {
  it('drops a null year rather than printing it', () => {
    expect(vehicleLabel({ year: null, make: 'Honda', model: 'Civic' })).toBe('Honda Civic');
  });

  it('drops a null make and model too', () => {
    expect(vehicleLabel({ year: 2026, make: null, model: null })).toBe('2026');
  });

  it('never leaves a double space or a stray edge', () => {
    expect(vehicleLabel({ year: 2026, make: null, model: 'Civic' })).toBe('2026 Civic');
    expect(vehicleLabel({ year: null, make: null, model: null })).toBe('');
  });

  it('drops missing parts in model-first order as well', () => {
    expect(vehicleLabel({ year: null, make: 'Honda', model: 'Civic' }, 'model-first')).toBe('Honda Civic');
  });
});

// ⭐⭐ WHAT IS MISSING FROM A CAR'S NAME — Aaron on LPU213 (2026-09-07): *"took me a sec to figure
// out what was still needed. at first i thought it was because no odo was recorded. but dismissed
// that because i have a lot that don't have a reading. but then realized make and model weren't
// showing."*
//
// `vehicleLabel` drops missing parts so a null never renders as "null" — correct, and exactly why
// the absence was invisible. This is its counterpart, and it is the SINGLE definition: Fleet's
// "Needs details" cohort delegates to it so the record and the count cannot drift.
describe('identityGaps — naming the absence', () => {
  const complete = { year: 2025, make: 'Nissan', model: 'Kicks' };

  it('a complete car has no gaps — the record shows nothing new', () => {
    expect(identityGaps(complete)).toEqual([]);
  });

  it('⭐ the real case: a year and a colour, no make or model', () => {
    expect(identityGaps({ year: 2024, make: '', model: '' })).toEqual(['make', 'model']);
  });

  it('treats whitespace as blank, because a space is not an answer', () => {
    expect(identityGaps({ ...complete, model: '   ' })).toEqual(['model']);
  });

  it('nulls count as gaps', () => {
    expect(identityGaps({ year: null, make: null, model: null })).toEqual(['year', 'make', 'model']);
  });

  // ⚠️ A blank year arrives as 0 or as a mis-read, never as a plausible model year — the floor
  // catches both, and mirrors the register form's own `year > 1999` submit guard.
  it('⚠️ a year below the floor is a gap, including the 0 sentinel', () => {
    expect(identityGaps({ ...complete, year: 0 })).toEqual(['year']);
    expect(identityGaps({ ...complete, year: 1998 })).toEqual(['year']);
    expect(identityGaps({ ...complete, year: 2000 })).toEqual([]);
  });

  it('reads as a sentence, with the comma right on three', () => {
    expect(describeIdentityGaps(['make', 'model'])).toBe('make and model');
    expect(describeIdentityGaps(['year', 'make', 'model'])).toBe('year, make and model');
    expect(describeIdentityGaps(['model'])).toBe('model');
    expect(describeIdentityGaps([])).toBe('');
  });
});

// ⚠️⚠️ FOUND BY RENDERING, NOT BY A TEST (2026-09-07). SB183H reads "Tesla Unknown · Unknown" and
// the first version of identityGaps called only its YEAR missing — "Unknown" is a non-blank string.
// It is a placeholder, not an identity, and a Tesla's model is knowable, so it is fillable.
describe('identityGaps — "Unknown" is a placeholder', () => {
  it('⭐ the rendered case: Tesla Unknown needs its model, not just its year', () => {
    expect(identityGaps({ year: 0, make: 'Tesla', model: 'Unknown' })).toEqual(['year', 'model']);
  });

  it('case- and space-insensitive, because the sentinel is written by several hands', () => {
    expect(identityGaps({ year: 2025, make: 'Tesla', model: '  UNKNOWN ' })).toEqual(['model']);
  });

  // ⚠️ THE OVER-REACH GUARD: the codex carries "Model 3" and "Model Y". A looser rule — substring,
  // or anything treating "Model" as suspicious — would accuse two real Teslas of having no model.
  it('⚠️ never accuses a real model that merely contains the word', () => {
    expect(identityGaps({ year: 2025, make: 'Tesla', model: 'Model Y' })).toEqual([]);
    expect(identityGaps({ year: 2025, make: 'Jeep', model: 'Unknown Trail' })).toEqual([]);
  });
});
