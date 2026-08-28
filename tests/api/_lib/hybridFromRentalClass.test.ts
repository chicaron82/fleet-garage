import { describe, it, expect } from 'vitest';
import { hybridFromRentalClass, lookupVehicleClass } from '../../../api/_lib/vehicleClassCodex';

// E6 is Hertz's powertrain-hybrid rental group. The codex's own `isHybrid` hint only fires for a
// class code it KNOWS — and on 2026-08-28 four cars proved that insufficient: two Priuses on an
// unknown code (CPHE), and two Sportage hybrids whose tags were printed with the ICE code (CSPT).
// Every one of them still carried the right rental class.

describe('hybridFromRentalClass', () => {
  it('fires on E6, the hybrid group', () => {
    expect(hybridFromRentalClass('E6')).toBe(true);
  });

  it('tolerates the shapes a tag read actually produces', () => {
    expect(hybridFromRentalClass('e6')).toBe(true);
    expect(hybridFromRentalClass(' E6 ')).toBe(true);
  });

  // ⭐ THE LOAD-BEARING ASSERTION. Not-E6 must never mean not-hybrid: large and premium hybrids
  // keep their segment class (Aaron: "that sienna, stays an R but hybrid is checked; several
  // Volvo's are hybrids but keep whatever class they are"). Returning `false` here would let this
  // hint UN-check a toggle the operator or the codex had rightly set.
  it('stays SILENT rather than denying — undefined, never false', () => {
    for (const rc of ['Q4', 'R', 'W4', 'Z4', 'B5', 'E1', 'E7', 'F', 'B6']) {
      expect(hybridFromRentalClass(rc)).toBeUndefined();
    }
  });

  it('is silent on an absent or empty class', () => {
    expect(hybridFromRentalClass(undefined)).toBeUndefined();
    expect(hybridFromRentalClass(null)).toBeUndefined();
    expect(hybridFromRentalClass('')).toBeUndefined();
  });
});

describe('the codex entries the E6 rule backs up', () => {
  // The Prius that registered twice as a non-hybrid because no entry existed.
  it('knows CPHE is a hybrid Prius', () => {
    expect(lookupVehicleClass('CPHE')).toEqual({ make: 'Toyota', model: 'Prius', isHybrid: true });
  });

  // ⚠️ CSPT stays ICE. 13 genuine petrol Sportages carry it; the two hybrids that landed on it had
  // MIS-PRINTED tags, and the rental class is what rescues those — not a codex lie.
  it('leaves CSPT as the ICE Sportage it really is', () => {
    expect(lookupVehicleClass('CSPT')?.isHybrid).toBeUndefined();
    expect(lookupVehicleClass('CSEH')?.isHybrid).toBe(true);
  });
});
