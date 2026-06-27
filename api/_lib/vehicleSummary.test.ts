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
  release: null,
  ...over,
});

const released = (over: Partial<HoldFact> = {}): HoldFact =>
  hold({
    holdType: 'damage',
    damageDescription: 'paint surface scratch',
    flaggedAt: '2026-06-19T10:00:00.000Z',
    flaggedByName: 'Aaron S.',
    status: 'RELEASED',
    release: { method: 'verbal_override', type: 'EXCEPTION', authorizedBy: 'MK' },
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

describe('summarizeLookup — active holds', () => {
  it('reports an unknown plate as not found', () => {
    const r = summarizeLookup('ZZZ999', null, []);
    expect(r.found).toBe(false);
    expect(r.vehicle).toBeNull();
    expect(r.activeHolds).toEqual([]);
    expect(r.releasedHolds).toEqual([]);
    expect(r.summary).toBe('No record of ZZZ999 in the fleet.');
  });

  it('says nothing is on a found vehicle with no holds at all', () => {
    const r = summarizeLookup('LUR187', camry, []);
    expect(r.found).toBe(true);
    expect(r.summary).toBe('Unit 1234567 · 2023 Toyota Camry (White) — nothing on it. No active or released holds.');
  });

  it('describes a single active hold with date, flagger, and damage', () => {
    const r = summarizeLookup('LUR187', camry, [hold()]);
    expect(r.activeHolds).toHaveLength(1);
    expect(r.summary).toBe(
      'Unit 1234567 · 2023 Toyota Camry (White) — 1 active hold: damage — front bumper scuff (flagged 2026-06-20 by Ray).',
    );
  });

  it('pluralises and joins multiple active holds', () => {
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

describe('summarizeLookup — released holds (context)', () => {
  it('surfaces a released hold when there is no active one — verbal override names the authorizer', () => {
    const r = summarizeLookup('LFJ318', camry, [released()]);
    expect(r.activeHolds).toEqual([]);
    expect(r.releasedHolds).toHaveLength(1);
    expect(r.summary).toBe(
      'Unit 1234567 · 2023 Toyota Camry (White) — no active hold, but previously damage — paint surface scratch (flagged 2026-06-19 by Aaron S.), released on a verbal override by MK.',
    );
  });

  it('a standard exception release reads "released as an exception"', () => {
    const r = summarizeLookup('LFJ318', camry, [
      released({ release: { method: 'standard', type: 'EXCEPTION', authorizedBy: null } }),
    ]);
    expect(r.summary).toContain('released as an exception');
  });

  it('a plain standard release just reads "released"', () => {
    const r = summarizeLookup('LFJ318', camry, [
      released({ release: { method: 'standard', type: 'PRE_EXISTING', authorizedBy: null } }),
    ]);
    expect(r.summary).toMatch(/scratch \(flagged 2026-06-19 by Aaron S\.\), released\.$/);
  });

  it('leads with active holds and trails released ones as context', () => {
    const r = summarizeLookup('LFJ318', camry, [hold(), released()]);
    expect(r.activeHolds).toHaveLength(1);
    expect(r.releasedHolds).toHaveLength(1);
    expect(r.summary).toContain('1 active hold: damage — front bumper scuff (flagged 2026-06-20 by Ray).');
    expect(r.summary).toContain('Also previously damage — paint surface scratch (flagged 2026-06-19 by Aaron S.), released on a verbal override by MK.');
  });

  it('a verbal override with no named authorizer omits the name', () => {
    const r = summarizeLookup('LFJ318', camry, [
      released({ release: { method: 'verbal_override', type: 'EXCEPTION', authorizedBy: null } }),
    ]);
    expect(r.summary).toContain('released on a verbal override.');
    expect(r.summary).not.toContain('override by');
  });
});
