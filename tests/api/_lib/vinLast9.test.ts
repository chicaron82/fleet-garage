import { describe, it, expect } from 'vitest';
import { normalizeVinLast9, vinYear, vinYearDisagrees } from '../../../api/_lib/vinLast9';

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

    // Check digits below keep a legal leading character — this test originally read 'ABCDEFGHJ'
    // and correctly began FAILING when the check-digit rule landed. The code got stricter; the
    // test was stale. Every VIN-legal LETTER still survives in positions 2-9.
    it('leaves every legal VIN letter alone', () => {
      expect(normalizeVinLast9('1BCDEFGHJ')).toBe('1BCDEFGHJ');
      expect(normalizeVinLast9('0KLMNPRST')).toBe('0KLMNPRST');
      expect(normalizeVinLast9('XUVWXYZ12')).toBe('XUVWXYZ12');
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

// ── The structure I said wasn't there (added 2026-08-25, same day, after the audit) ───────────
// I shipped this file asserting "a VIN has no oracle" and built the backfill's whole safety
// argument on it. Two free checks were inside the string the entire time. Aaron: "wanna double
// check everything yourself too" — the audit they enabled caught a VIN BOTH models had agreed on.
describe('the check digit — position 9, absolute', () => {
  it('accepts 0-9 and X, the only legal check digits', () => {
    for (const c of '0123456789X') expect(normalizeVinLast9(`${c}TR289777`)).toBe(`${c}TR289777`);
  });

  it('REJECTS a letter check digit — this is what VXSL47717 failed', () => {
    expect(normalizeVinLast9('VXSL47717')).toBe('');   // the real one that reached a record
    expect(normalizeVinLast9('ATR289777')).toBe('');
    expect(normalizeVinLast9('NTR289777')).toBe('');
  });

  it('still accepts every real VIN read off Aaron\'s tags', () => {
    expect(normalizeVinLast9('9TR289777')).toBe('9TR289777');   // the Suburban
    expect(normalizeVinLast9('8NF258345')).toBe('8NF258345');   // LJF679
    expect(normalizeVinLast9('7T7499118')).toBe('7T7499118');   // LUR489
    expect(normalizeVinLast9('4SE105455')).toBe('4SE105455');   // LFJ445
  });
});

describe('vinYear — position 10 is the model year', () => {
  it('decodes the year straight off the tags, matching what FG has', () => {
    expect(vinYear('8NF258345')).toBe(2022);   // LJF679, a 2022 Tesla ✓
    expect(vinYear('7T7499118')).toBe(2026);   // LUR489, a 2026 Sportage ✓
    expect(vinYear('9TR289777')).toBe(2026);   // the Suburban, a 2026 ✓
  });

  it('skips the letters a VIN year never uses', () => {
    expect(vinYear('1IR289777')).toBeNull();
    expect(vinYear('1UR289777')).toBeNull();
  });
});

describe('vinYearDisagrees — advisory, never a rejection', () => {
  it('agrees when the VIN and the record tell the same story', () => {
    expect(vinYearDisagrees('7T7499118', 2026)).toBe(false);
    expect(vinYearDisagrees('8NF258345', 2022)).toBe(false);
  });

  it('flags the live case: a Rogue on record as 2024 whose VIN says 2025', () => {
    expect(vinYearDisagrees('5SW414560', 2024)).toBe(true);
  });

  // ⚠️ It must NOT reject. FG's own `year` is operator- or codex-supplied and can be wrong, so
  // refusing the write would let a bad year permanently block a good VIN under first-write-wins.
  it('says nothing when either side is missing — silence is not a disagreement', () => {
    expect(vinYearDisagrees('7T7499118', null)).toBe(false);
    expect(vinYearDisagrees('7T7499118', 0)).toBe(false);
    expect(vinYearDisagrees('', 2026)).toBe(false);
  });
});
