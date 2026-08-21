import { describe, it, expect } from 'vitest';
import { lookupVehicleClass, normalizeClassCode } from '../../api/_lib/vehicleClassCodex';

describe('curated codex — codes must match what the tags actually print', () => {
  it('⭐ CVTA is the Volkswagen Taos code, and CTVA is not a code at all', () => {
    // 2026-08-21: the curated entry carried a transposition, and migration 121 propagated it onto
    // 25 vehicles by inverting make+model through it. Four physical tags read CVTA — LUR184,
    // LFJ390, DEWJ042 and MCN122 — and none read CTVA.
    expect(lookupVehicleClass('CVTA')).toEqual({ make: 'Volkswagen', model: 'Taos' });
    expect(lookupVehicleClass('CTVA')).toBeNull();
  });

  it('resolves the other codes verified off physical tags this week', () => {
    expect(lookupVehicleClass('CKSE')).toMatchObject({ make: 'Kia', model: 'Seltos' });
    expect(lookupVehicleClass('CALE')).toMatchObject({ make: 'GMC', model: 'Acadia' });
    expect(lookupVehicleClass('CCRL')).toMatchObject({ make: 'Toyota', model: 'Corolla' });
    expect(lookupVehicleClass('CCLH')).toMatchObject({ make: 'Toyota', model: 'Corolla', isHybrid: true });
  });

  it('⭐ an unknown code returns null rather than a guess', () => {
    // The safe direction: a genuine CTVA (or any unseen code) logs as unknown and Aaron decides,
    // instead of silently resolving to whatever looks close.
    expect(lookupVehicleClass('ZZZZ')).toBeNull();
    expect(lookupVehicleClass('')).toBeNull();
  });

  it('normalizes case and whitespace before looking up', () => {
    expect(normalizeClassCode(' cvta ')).toBe('CVTA');
    expect(lookupVehicleClass(normalizeClassCode(' cvta '))).toMatchObject({ model: 'Taos' });
  });
});
