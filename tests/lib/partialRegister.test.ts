import { describe, it, expect } from 'vitest';
import { scannedFromRead, canRegisterPartially, isUnknownClassCode } from '../../src/lib/partialRegister';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// The real tag that exposed this: LUR437, unit 5429949, "CDGT 26 BLA 4DR" — CDGT wasn't codexed,
// so make/model came back empty while everything else read fine.
const DURANGO: KeytagRead = {
  plate: 'LUR437', unitNumber: '5429949', classCode: 'CDGT', year: 2026, color: 'Black',
};

describe('scannedFromRead', () => {
  it('keeps every field the tag DID give, blanking only what it did not', () => {
    expect(scannedFromRead(DURANGO, 'LUR437')).toEqual({
      unitNumber: '5429949', plate: 'LUR437', make: '', model: '', year: 2026, color: 'Black', rentalClass: '', isHybrid: false, teachClassCode: 'CDGT',
    });
  });

  it('never returns null on an incomplete read — that was the whole bug', () => {
    expect(scannedFromRead({ plate: 'AAA111' }, 'AAA111')).toEqual({
      unitNumber: '', plate: 'AAA111', make: '', model: '', year: 0, color: '', rentalClass: '', isHybrid: false, teachClassCode: undefined,
    });
  });

  it('carries the rental class read off the tag through to registration', () => {
    const cx5: KeytagRead = { plate: 'LUR119', unitNumber: '5421433', classCode: 'CC5S', rentalClass: 'Q4', year: 2025, color: 'Red' };
    expect(scannedFromRead(cx5, 'LUR119').rentalClass).toBe('Q4');
  });

  it('carries the hybrid flag so a scanned hybrid tag pre-checks the register toggle', () => {
    // CCMH etc. resolve (in keytag-read) to base model + isHybrid; that flag must reach the form.
    const camryHybrid: KeytagRead = { plate: 'LUR266', unitNumber: '5422118', make: 'Toyota', model: 'Camry', isHybrid: true, rentalClass: 'E6', year: 2025, color: 'White' };
    expect(scannedFromRead(camryHybrid, 'LUR266').isHybrid).toBe(true);
    // …and a gas read defaults it off, never undefined.
    expect(scannedFromRead(DURANGO, 'LUR437').isHybrid).toBe(false);
  });

  it('carries the INFERRED flag so the form flags a class it inferred vs one it read', () => {
    const inferred: KeytagRead = { plate: 'LUR256', unitNumber: '5425999', classCode: 'CVRS', make: 'Nissan', model: 'Versa', rentalClass: 'B', rentalClassInferred: true, year: 2025 };
    expect(scannedFromRead(inferred, 'LUR256').rentalClassInferred).toBe(true);
    // a straight tag read leaves it falsy — read off the tag, not inferred.
    expect(scannedFromRead({ plate: 'LUR119', unitNumber: '5421433', rentalClass: 'Q4' }, 'LUR119').rentalClassInferred).toBeUndefined();
  });
});

describe('canRegisterPartially', () => {
  it('offers registration on plate + unit# even with no make/model', () => {
    expect(canRegisterPartially(DURANGO, 'LUR437')).toBe(true);
  });

  it('declines when the unit# is missing — too thin to be a real record', () => {
    expect(canRegisterPartially({ plate: 'LUR437', classCode: 'CDGT' }, 'LUR437')).toBe(false);
    expect(canRegisterPartially({ plate: 'LUR437', unitNumber: '  ' }, 'LUR437')).toBe(false);
  });

  it('declines with no plate', () => {
    expect(canRegisterPartially({ unitNumber: '5429949' }, '')).toBe(false);
  });
});

describe('isUnknownClassCode', () => {
  it('flags a code the codex could not resolve', () => {
    expect(isUnknownClassCode(DURANGO)).toBe(true);
  });

  it('does not flag a resolved code', () => {
    expect(isUnknownClassCode({ ...DURANGO, make: 'Dodge', model: 'Durango' })).toBe(false);
  });

  it('does not flag an unreadable class line — nothing to report', () => {
    expect(isUnknownClassCode({ plate: 'LUR437' })).toBe(false);
    expect(isUnknownClassCode({ plate: 'LUR437', classCode: '  ' })).toBe(false);
  });
});

// Registering a car whose code the codex missed is what TEACHES the codex — so the code has to
// ride along, and ONLY when there's something to learn.
describe('scannedFromRead — the teach signal', () => {
  it('carries the unresolved code, so registering the car teaches it', () => {
    expect(scannedFromRead(DURANGO, 'LUR437').teachClassCode).toBe('CDGT');
  });

  it('carries NOTHING when the codex already resolved the code — nothing to learn', () => {
    const known: KeytagRead = { plate: 'MCN133', unitNumber: '5423587', classCode: 'CCVL', make: 'Kia', model: 'Carnival' };
    expect(scannedFromRead(known, 'MCN133').teachClassCode).toBeUndefined();
  });

  it('normalises the code it teaches (tags print "CDGT 26", casing varies)', () => {
    const messy: KeytagRead = { plate: 'LUR437', unitNumber: '5429949', classCode: ' cdgt 26 ' };
    expect(scannedFromRead(messy, 'LUR437').teachClassCode).toBe('CDGT');
  });

  it('teaches nothing when the tag had no code at all', () => {
    expect(scannedFromRead({ plate: 'AAA111' }, 'AAA111').teachClassCode).toBeUndefined();
  });
});
