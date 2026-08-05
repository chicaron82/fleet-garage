import { describe, it, expect } from 'vitest';
import { lookupVehicleClass, isEvModel } from '../../../api/_lib/vehicleClassCodex';

describe('isEvModel', () => {
  it('recognizes a battery-EV model marked isEv in the codex (case/space tolerant)', () => {
    expect(isEvModel('Niro EV')).toBe(true);   // CKNE — the EV case that drives the charge-% gauge
    expect(isEvModel('niro ev')).toBe(true);
    expect(isEvModel('  Niro EV ')).toBe(true);
  });

  it('is false for non-EV models — including distinctly-named non-EV variants and hybrids', () => {
    expect(isEvModel('Niro')).toBe(false);      // a non-EV Niro would be its own model string
    expect(isEvModel('Versa')).toBe(false);
    expect(isEvModel('RAV4')).toBe(false);      // gas/hybrid, not a battery-EV
    expect(isEvModel('Sportage')).toBe(false);  // has a hybrid variant but is not a battery-EV
  });

  it('handles null/undefined/empty safely', () => {
    expect(isEvModel(null)).toBe(false);
    expect(isEvModel(undefined)).toBe(false);
    expect(isEvModel('')).toBe(false);
  });
});

describe('lookupVehicleClass', () => {
  it('maps a known class code to make/model (the tag that prompted this feature)', () => {
    expect(lookupVehicleClass('CCVL')).toEqual({ make: 'Kia', model: 'Carnival' });
  });

  it('tolerates the raw tag token "CCVL 25" and lowercase/whitespace', () => {
    expect(lookupVehicleClass('CCVL 25')).toEqual({ make: 'Kia', model: 'Carnival' });
    expect(lookupVehicleClass('  ccvl  ')).toEqual({ make: 'Kia', model: 'Carnival' });
  });

  it('resolves a spread of makes', () => {
    expect(lookupVehicleClass('CUES')).toEqual({ make: 'Ford', model: 'Escape' });
    expect(lookupVehicleClass('CTM3')).toEqual({ make: 'Tesla', model: 'Model 3' });
    expect(lookupVehicleClass('C3US')).toEqual({ make: 'Tesla', model: 'Model 3' }); // 3rd Model 3 code, Aaron confirmed at the car 2026-07-20
    expect(lookupVehicleClass('CGCL')).toEqual({ make: 'Dodge', model: 'Grand Caravan' });
    expect(lookupVehicleClass('CELA')).toEqual({ make: 'Hyundai', model: 'Elantra' }); // C-prefix but Hyundai
    expect(lookupVehicleClass('CSEH')).toEqual({ make: 'Kia', model: 'Sportage', isHybrid: true }); // hybrid is a flag now (migration 109), base model + hint (cf CSPT)
    expect(lookupVehicleClass('CALE')).toEqual({ make: 'GMC', model: 'Acadia' }); // added 2026-07-17, the gap Aaron flagged
    expect(lookupVehicleClass('CTLT')).toEqual({ make: 'Chevrolet', model: 'Traverse' }); // added 2026-07-17 (L2 class)
    expect(lookupVehicleClass('C6CU')).toEqual({ make: 'Volvo', model: 'XC60' }); // added 2026-07-20, Aaron visually confirmed on unit 5427752
    expect(lookupVehicleClass('CX4U')).toEqual({ make: 'Volvo', model: 'XC40' }); // added 2026-07-20, Aaron confirmed XC40 (unit 5429683)
    expect(lookupVehicleClass('CWUR')).toEqual({ make: 'Jeep', model: 'Wrangler' }); // added 2026-07-20, the boss's "V class" (unit 5427331 / LUR573)
    expect(lookupVehicleClass('CGXA')).toEqual({ make: 'Buick', model: 'Encore' }); // added 2026-07-20, Aaron confirmed (unit 5427851 / LUR575)
    expect(lookupVehicleClass('CEGX')).toEqual({ make: 'Buick', model: 'Encore' }); // added 2026-07-20, older Encore code
    expect(lookupVehicleClass('CTCF')).toEqual({ make: 'Volkswagen', model: 'Tiguan' }); // added 2026-07-20, Aaron confirmed (unit 5429832 / LUR466)
    expect(lookupVehicleClass('CSBZ')).toEqual({ make: 'Chevrolet', model: 'Suburban' }); // added 2026-07-20, Aaron confirmed (unit 5426945 / LUR375, T6)
  });

  it('returns null for unknown / empty codes (assistant then asks for make/model)', () => {
    expect(lookupVehicleClass('CZZZ')).toBeNull();
    expect(lookupVehicleClass('')).toBeNull();
    expect(lookupVehicleClass(undefined)).toBeNull();
  });
});
