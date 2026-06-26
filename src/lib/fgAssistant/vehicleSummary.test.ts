import { describe, it, expect } from 'vitest';
import { describeVehicle, summarizeLookup, type VehicleFact, type HoldFact } from './vehicleSummary';

const camry: VehicleFact = {
  plate: 'LUR187',
  unitNumber: '1234567',
  year: 2023,
  make: 'Toyota',
  model: 'Camry',
  color: 'White',
};

const hold = (over: Partial<HoldFact> = {}): HoldFact => ({
  holdType: 'damage',
  status: 'ACTIVE',
  damageDescription: 'front bumper scuff',
  flaggedAt: '2026-06-20T14:30:00.000Z',
  flaggedByName: 'Ray',
  ...over,
});

describe('describeVehicle', () => {
  it('builds the full identity line', () => {
    expect(describeVehicle(camry)).toBe('Unit 1234567 · 2023 Toyota Camry (White)');
  });

  it('skips unknown parts and falls back to the plate', () => {
    expect(
      describeVehicle({ plate: 'ABC1', unitNumber: null, year: null, make: null, model: null, color: null }),
    ).toBe('ABC1');
  });

  it('drops the colour when unknown', () => {
    expect(describeVehicle({ ...camry, color: null })).toBe('Unit 1234567 · 2023 Toyota Camry');
  });
});

describe('summarizeLookup', () => {
  it('reports an unknown plate as not found', () => {
    const r = summarizeLookup('ZZZ999', null, []);
    expect(r.found).toBe(false);
    expect(r.vehicle).toBeNull();
    expect(r.activeHolds).toEqual([]);
    expect(r.summary).toBe('No record of ZZZ999 in the fleet.');
  });

  it('says nothing is on a found vehicle with no active holds', () => {
    const r = summarizeLookup('LUR187', camry, []);
    expect(r.found).toBe(true);
    expect(r.summary).toBe('Unit 1234567 · 2023 Toyota Camry (White) — nothing on it. No active holds.');
  });

  it('describes a single active hold with date, flagger, and damage', () => {
    const r = summarizeLookup('LUR187', camry, [hold()]);
    expect(r.activeHolds).toHaveLength(1);
    expect(r.summary).toBe(
      'Unit 1234567 · 2023 Toyota Camry (White) — 1 active hold: damage — front bumper scuff (flagged 2026-06-20 by Ray).',
    );
  });

  it('pluralises and joins multiple holds', () => {
    const r = summarizeLookup('LUR187', camry, [
      hold(),
      hold({ holdType: 'mechanical', damageDescription: 'check engine', flaggedByName: 'Geoff' }),
    ]);
    expect(r.summary).toContain('2 active holds:');
    expect(r.summary).toContain('mechanical — check engine (flagged 2026-06-20 by Geoff)');
  });

  it('omits the dash when a hold has no damage description', () => {
    const r = summarizeLookup('LUR187', camry, [hold({ damageDescription: '' })]);
    expect(r.summary).toBe('Unit 1234567 · 2023 Toyota Camry (White) — 1 active hold: damage (flagged 2026-06-20 by Ray).');
  });

  it('handles an unknown flagger', () => {
    const r = summarizeLookup('LUR187', camry, [hold({ flaggedByName: null })]);
    expect(r.summary).toContain('damage — front bumper scuff (flagged 2026-06-20)');
  });
});
