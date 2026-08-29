import { describe, it, expect } from 'vitest';
import { hybridFlagGaps, describeHybridGap, type HybridGapVehicle } from '../../src/lib/hybridGaps';

// ⭐ Aaron, 2026-08-29: "we're building on top of things that already exist... but now that only
// applies to vehicles that i have personally come across. there are probably several more that are
// different and don't match exactly." Every powertrain fix so far was to a car he happened to touch.
//
// ⚠️ And the proof is our own history: two Priuses were identified as unflagged hybrids on 2026-08-28
// and were STILL unflagged the next morning — because a finding delivered in a message has nowhere
// to live.

const car = (over: Partial<HybridGapVehicle>): HybridGapVehicle => ({
  id: 'v1', licensePlate: 'LUR100', year: 2025, make: 'Toyota', model: 'Corolla',
  classCode: null, rentalClass: null, isHybrid: false, ...over,
});

describe('hybridFlagGaps — something says hybrid and the flag is off', () => {
  it('⭐ flags an E6 car that is not marked hybrid — the two live Priuses', () => {
    const gaps = hybridFlagGaps([
      car({ licensePlate: 'LUR433', model: 'Prius', classCode: 'CPHE', rentalClass: 'E6' }),
      car({ licensePlate: 'FVJ1788', model: 'Prius', classCode: 'CPHE', rentalClass: 'E6' }),
    ]);
    expect(gaps.map(g => g.vehicle.licensePlate)).toEqual(['FVJ1788', 'LUR433']);
    expect(gaps[0].reasons).toEqual(['rental-class', 'model-code']);
  });

  it('flags on the rental class alone', () => {
    const [g] = hybridFlagGaps([car({ rentalClass: 'E6' })]);
    expect(g.reasons).toEqual(['rental-class']);
  });

  it('flags on the model code alone', () => {
    const [g] = hybridFlagGaps([car({ classCode: 'CCMH' })]);   // codex: Camry, isHybrid
    expect(g.reasons).toEqual(['model-code']);
  });
});

describe('hybridFlagGaps — what it must NEVER say', () => {
  it('⚠️⚠️ never second-guesses a flag he has SET, whatever the code says', () => {
    // "the civic model code is correct for an ICE version... i do not know the real hybrid code for
    // it. so having the hybrid flag works." The code records what is PRINTED; the flag records what
    // is TRUE. A hybrid wearing an ICE code is the correct workaround, not a disagreement.
    expect(hybridFlagGaps([car({ isHybrid: true, classCode: 'CCVC', rentalClass: 'E6' })])).toEqual([]);
    expect(hybridFlagGaps([car({ isHybrid: true, classCode: 'CSPT', rentalClass: 'Q4' })])).toEqual([]);
  });

  it('⚠️ says nothing about a hybrid outside E6 — not-E6 never means not-hybrid', () => {
    // hybridFromRentalClass is one-way for the same reason: a premium hybrid keeps its segment class.
    expect(hybridFlagGaps([car({ rentalClass: 'R' })])).toEqual([]);
    expect(hybridFlagGaps([car({ rentalClass: 'F' })])).toEqual([]);
  });

  it('says nothing about an ordinary petrol car', () => {
    expect(hybridFlagGaps([car({ classCode: 'CSPT', rentalClass: 'Q4' })])).toEqual([]);
  });

  it('says nothing about a code the codex does not know', () => {
    expect(hybridFlagGaps([car({ classCode: 'ZZZZ' })])).toEqual([]);
  });

  it('is case- and space-insensitive on the rental class', () => {
    expect(hybridFlagGaps([car({ rentalClass: ' e6 ' })])).toHaveLength(1);
  });

  it('returns nothing rather than throwing on an empty fleet', () => {
    expect(hybridFlagGaps([])).toEqual([]);
  });
});

describe('describeHybridGap', () => {
  it('gives the evidence, never a verdict', () => {
    const [g] = hybridFlagGaps([car({ classCode: 'CPHE', rentalClass: 'E6' })]);
    expect(describeHybridGap(g)).toBe('its rental class is E6 and its model code CPHE is a hybrid code');
  });

  it('names a single reason on its own', () => {
    const [g] = hybridFlagGaps([car({ rentalClass: 'E6' })]);
    expect(describeHybridGap(g)).toBe('its rental class is E6');
  });
});
