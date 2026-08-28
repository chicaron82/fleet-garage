import { describe, it, expect } from 'vitest';
import { vehicleLabel, powertrainBadge, type NamedVehicle } from '../../src/lib/vehicleName';

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
