import { describe, it, expect } from 'vitest';
import { normalizeVinLast9 } from '../../../api/_lib/vinLast9';

// The last 9 of the VIN, off the key tag. FG read straight past this field for the scanner's whole
// life; migration 126 stores it because it is the ONLY identifier on that tag that survives a
// re-plate — which is exactly what Aaron's out-of-province → MB conversions do to the plate FG
// searches by.

describe('normalizeVinLast9', () => {
  it('takes a clean nine straight through', () => {
    expect(normalizeVinLast9('9TR289777')).toBe('9TR289777');   // the Suburban's tag
    expect(normalizeVinLast9('8NF258345')).toBe('8NF258345');   // LJF679's tag
  });

  it('strips the noise a printed tag and a vision read add', () => {
    expect(normalizeVinLast9(' 9tr 289-777 ')).toBe('9TR289777');
    expect(normalizeVinLast9('9TR_289.777')).toBe('9TR289777');
  });

  // ⭐ A CORRECTION, NOT A GUESS — and that's what makes it safe to do unconditionally. The VIN
  // standard EXCLUDES I, O and Q precisely because they're confusable with 1, 0 and 0. So a read
  // containing one is, by construction, a misread of a digit: there is no legitimate VIN it could
  // belong to. Contrast correctManitobaPlate, which needs a known-prefix gate before touching a
  // character, because plates carry no such guarantee.
  describe('the I/O/Q substitution', () => {
    it('maps the three letters a VIN can never contain onto the digits they were', () => {
      expect(normalizeVinLast9('I23456789')).toBe('123456789');
      expect(normalizeVinLast9('O23456789')).toBe('023456789');
      expect(normalizeVinLast9('Q23456789')).toBe('023456789');
    });

    it('corrects them wherever they land, not just the first character', () => {
      expect(normalizeVinLast9('9TRO89I77')).toBe('9TR089177');
    });

    it('leaves every legal VIN letter alone', () => {
      expect(normalizeVinLast9('ABCDEFGHJ')).toBe('ABCDEFGHJ');
      expect(normalizeVinLast9('KLMNPRSTU')).toBe('KLMNPRSTU');
    });
  });

  // ⭐ A PARTIAL IS WORSE THAN NOTHING. It wears the shape of an identity key while being unable to
  // identify anything, and it would quietly poison a match the moment someone trusted it. So the
  // length rule is absolute: nine, or ''.
  describe('rejecting anything that is not a usable nine', () => {
    it('refuses a short read rather than salvaging it', () => {
      expect(normalizeVinLast9('9TR2897')).toBe('');
      expect(normalizeVinLast9('8')).toBe('');
    });

    it('refuses a long read — never truncates to make it fit', () => {
      expect(normalizeVinLast9('1FTFW1E50NFA12345')).toBe('');   // a FULL vin is not a last-9
      expect(normalizeVinLast9('9TR2897770')).toBe('');
    });

    it('handles absent, blank and junk input', () => {
      expect(normalizeVinLast9(undefined)).toBe('');
      expect(normalizeVinLast9(null)).toBe('');
      expect(normalizeVinLast9('')).toBe('');
      expect(normalizeVinLast9('   ')).toBe('');
      expect(normalizeVinLast9('N/A')).toBe('');
      expect(normalizeVinLast9('---------')).toBe('');
    });

    it('does not let punctuation-stripping manufacture a valid nine from a shorter read', () => {
      // "9TR-289-77" is ten characters of text but only EIGHT of VIN — must not pass.
      expect(normalizeVinLast9('9TR-289-77')).toBe('');
    });
  });

  it('is idempotent — re-normalising a stored value never changes it', () => {
    const once = normalizeVinLast9('9tro89i77');
    expect(normalizeVinLast9(once)).toBe(once);
  });
});
