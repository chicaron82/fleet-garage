import { describe, it, expect } from 'vitest';
import { vehicleLabel, powertrainBadge, type NamedVehicle, vehicleNameText } from '../../src/lib/vehicleName';

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
