import { describe, it, expect } from 'vitest';
import { lookupVehicleClass, sameModelFamily, modelCodeMismatch } from '../../api/_lib/vehicleClassCodex';
import { modelCodeRuling, misreadOf } from '../../api/_lib/modelCodeRulings';

// Aaron, 2026-10-01, reading the Model codes audit: *"CBRS, we keep discussing this, but past you
// doesn't write it down."* These pin what he said that evening, so the next change to the list has to
// argue with a test instead of with him.

describe('what he said each code is', () => {
  it('⭐ CCMH is the Camry SE Hybrid, CCSE the Camry SE, CCAM the base Camry', () => {
    expect(lookupVehicleClass('CCMH')).toEqual({ make: 'Toyota', model: 'Camry SE', isHybrid: true });
    expect(lookupVehicleClass('CCSE')).toEqual({ make: 'Toyota', model: 'Camry SE' });
    expect(lookupVehicleClass('CCAM')).toEqual({ make: 'Toyota', model: 'Camry' });
  });

  it('CRHX is the RAV4 Hybrid, CRVB the base RAV4', () => {
    expect(lookupVehicleClass('CRHX')).toEqual({ make: 'Toyota', model: 'RAV4', isHybrid: true });
    expect(lookupVehicleClass('CRVB')).toEqual({ make: 'Toyota', model: 'RAV4' });
  });

  it('⭐ CBZL is the real Blazer code, CQRS the Equinox, CCVC the GAS Civic', () => {
    expect(lookupVehicleClass('CBZL')).toEqual({ make: 'Chevrolet', model: 'Blazer' });
    expect(lookupVehicleClass('CQRS')).toEqual({ make: 'Chevrolet', model: 'Equinox' });
    // Not isHybrid: the one Civic in the fleet is a hybrid, and it wears a different code.
    expect(lookupVehicleClass('CCVC')).toEqual({ make: 'Honda', model: 'Civic' });
  });

  // ⚠️⚠️ The entry looks wrong and is deliberate. CBRS READS Blazer RS; the car wearing it is a
  // Trailblazer; FG follows the car. Anyone "fixing" it to Blazer breaks this on purpose.
  it('⭐⭐ CBRS fills in Trailblazer, and carries his ruling saying why', () => {
    expect(lookupVehicleClass('CBRS')).toEqual({ make: 'Chevrolet', model: 'Trailblazer' });
    expect(modelCodeRuling('CBRS')).toMatch(/Blazer RS.*Trailblazer/);
    expect(modelCodeRuling(' cbrs ')).toBe(modelCodeRuling('CBRS'));
  });

  // *"CCMR a misread for CCMH"* — and DEYT759's tag prints `CCMH 25`. The built-in list had an entry
  // for it ("1 car, class E6"), which CLEARS a code in the audit. A misread must never be built in.
  it('⭐⭐ CCMR is a ruled misread of CCMH, and the built-in list does not vouch for it', () => {
    expect(lookupVehicleClass('CCMR')).toBeNull();
    expect(misreadOf('CCMR')).toBe('CCMH');
    expect(misreadOf(' ccmr ')).toBe('CCMH');
    expect(modelCodeRuling('CCMR')).toMatch(/misread of CCMH/);
    // …and the code it is a misread of is real.
    expect(lookupVehicleClass(misreadOf('CCMR'))).toEqual({ make: 'Toyota', model: 'Camry SE', isHybrid: true });
    expect(misreadOf('CCMH')).toBeNull();
    expect(misreadOf(null)).toBeNull();
  });

  it('has no ruling for a code he has not ruled on', () => {
    expect(modelCodeRuling('CTXF')).toBeNull();
    expect(modelCodeRuling('')).toBeNull();
    expect(modelCodeRuling(null)).toBeNull();
  });
});

describe('sameModelFamily', () => {
  it('agrees across a trim, in either direction', () => {
    expect(sameModelFamily('Toyota', 'Camry SE', 'Toyota', 'Camry')).toBe(true);
    expect(sameModelFamily('Toyota', 'Camry', 'Toyota', 'Camry SE')).toBe(true);
    expect(sameModelFamily('Toyota', 'RAV4 Hybrid', 'Toyota', 'RAV4')).toBe(true);
    expect(sameModelFamily('TOYOTA', 'rav-4', 'Toyota', 'RAV4')).toBe(true);
  });

  it('⭐ does not confuse Blazer with Trailblazer, or one make with another', () => {
    expect(sameModelFamily('Chevrolet', 'Blazer', 'Chevrolet', 'Trailblazer')).toBe(false);
    expect(sameModelFamily('Chevrolet', 'Trax', 'Chevrolet', 'Trailblazer')).toBe(false);
    expect(sameModelFamily('Honda', 'RAV4', 'Toyota', 'RAV4')).toBe(false);
  });

  it('a blank make is not a disagreement, a blank model is never agreement', () => {
    expect(sameModelFamily('', 'Camry', 'Toyota', 'Camry')).toBe(true);
    expect(sameModelFamily('Toyota', '', 'Toyota', 'Camry')).toBe(false);
    expect(sameModelFamily(null, null, 'Toyota', 'Camry')).toBe(false);
  });

  it('modelCodeMismatch still answers as it did before the rule was shared', () => {
    expect(modelCodeMismatch('CSPT', 'Kia', 'Seltos')).toMatchObject({ code: 'CSPT', codexModel: 'Sportage' });
    expect(modelCodeMismatch('CRVB', 'Honda', 'RAV4')).toBeTruthy();
    expect(modelCodeMismatch('CCMH', 'Toyota', 'Camry')).toBeNull();
    expect(modelCodeMismatch('CRVB', '', 'RAV4')).toBeNull();
    expect(modelCodeMismatch('CRVB', 'Toyota', '  ')).toBeNull();
  });
});
