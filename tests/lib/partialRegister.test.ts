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
      unitNumber: '5429949', plate: 'LUR437', make: '', model: '', year: 2026, color: 'Black', rentalClass: '',
    });
  });

  it('never returns null on an incomplete read — that was the whole bug', () => {
    expect(scannedFromRead({ plate: 'AAA111' }, 'AAA111')).toEqual({
      unitNumber: '', plate: 'AAA111', make: '', model: '', year: 0, color: '', rentalClass: '',
    });
  });

  it('carries the rental class read off the tag through to registration', () => {
    const cx5: KeytagRead = { plate: 'LUR119', unitNumber: '5421433', classCode: 'CC5S', rentalClass: 'Q4', year: 2025, color: 'Red' };
    expect(scannedFromRead(cx5, 'LUR119').rentalClass).toBe('Q4');
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
