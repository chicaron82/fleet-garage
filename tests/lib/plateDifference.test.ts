import { describe, it, expect } from 'vitest';
import { classifyPlateDifference, shouldOfferPlateUpdate } from '../../src/lib/plateDifference';

describe('classifyPlateDifference', () => {
  it('says same when they agree, whitespace and case aside', () => {
    expect(classifyPlateDifference('LUR143', 'LUR143')).toBe('same');
    expect(classifyPlateDifference(' lur 143 ', 'LUR143')).toBe('same');
  });

  // ⚠️ REAL MISREADS FROM THIS FLEET. Every one of these created a duplicate vehicle record before
  // the unit-number fallback existed, and each was resolved by Aaron by hand.
  describe('the reads that actually went wrong', () => {
    it('LURL43 is LUR143 seen badly — L in a digit slot', () => {
      expect(classifyPlateDifference('LURL43', 'LUR143')).toBe('misread');
    });

    it('OGK641 is 0GK641 seen badly — letter O for digit zero', () => {
      expect(classifyPlateDifference('OGK641', '0GK641')).toBe('misread');
    });

    it('OEJ761 is 0EJ761 seen badly', () => {
      expect(classifyPlateDifference('OEJ761', '0EJ761')).toBe('misread');
    });

    // ⚠️ 5 and 3 are NOT a confusable pair in the table, so this one only survives on the
    // one-position rule. It is exactly the case that would slip through a confusable-only check.
    it('LUR234 vs LUR254 — one position off, not a known confusable pair', () => {
      expect(classifyPlateDifference('LUR234', 'LUR254')).toBe('misread');
    });
  });

  // ⭐⭐ THE CASE THIS MODULE EXISTS FOR. Aaron's Suburban: unit 5769880, Calgary-owned, Alberta
  // plate 0GK641, given Manitoba plates on 2026-08-26. Everything on the tag survives except the plate.
  describe('a car that was re-plated', () => {
    it('Alberta 0GK641 → a Manitoba plate is a re-plate, not a bad read', () => {
      expect(classifyPlateDifference('LZM500', '0GK641')).toBe('replate');
      expect(classifyPlateDifference('LUR900', '0GK641')).toBe('replate');
    });

    it('recognises it from the province FORMAT alone', () => {
      // 9AA999 (AB) vs AAA999 (MB). A vision read does not turn one shape into the other.
      expect(classifyPlateDifference('LUR143', '0EJ761')).toBe('replate');
    });

    it('two different MB plates on one car is also a re-plate', () => {
      expect(classifyPlateDifference('LZM500', 'LUR143')).toBe('replate');
    });

    it('an Ontario plate replaced by a Manitoba one', () => {
      expect(classifyPlateDifference('LUR143', 'DFDA712')).toBe('replate');
    });
  });

  it('is unclear when either side is missing — never guesses from one plate', () => {
    expect(classifyPlateDifference(null, 'LUR143')).toBe('unclear');
    expect(classifyPlateDifference('LUR143', '')).toBe('unclear');
    expect(classifyPlateDifference(undefined, undefined)).toBe('unclear');
  });
});

describe('shouldOfferPlateUpdate', () => {
  // ⭐ The safety property. Offering to adopt a MISREAD plate would write a plate the car does not
  // have — the precise failure the plate-authoritative rule was written to prevent. It must stay
  // false for every real misread this fleet has produced.
  it('never offers on a misread', () => {
    for (const [tag, record] of [
      ['LURL43', 'LUR143'], ['OGK641', '0GK641'], ['OEJ761', '0EJ761'], ['LUR234', 'LUR254'],
    ]) {
      expect(shouldOfferPlateUpdate(tag, record)).toBe(false);
    }
  });

  it('offers on a genuine re-plate', () => {
    expect(shouldOfferPlateUpdate('LZM500', '0GK641')).toBe(true);
  });

  it('offers nothing when they match, or when one is missing', () => {
    expect(shouldOfferPlateUpdate('LUR143', 'LUR143')).toBe(false);
    expect(shouldOfferPlateUpdate(null, 'LUR143')).toBe(false);
  });
});

// FTR2260's tag was printed with the perforation through its left column, so the plate reads
// TR2260. AA9999 against AAA9999 — a format change, which the shape rule calls "the strongest
// re-plate signal there is". It offered to overwrite a plate Aaron had verified against the car's
// own barcode sticker and the physical plate.
describe('a clipped tag is not a re-plate', () => {
  it('⭐⭐ TR2260 against FTR2260 is a misread — the record is right and must not be touched', () => {
    expect(classifyPlateDifference('TR2260', 'FTR2260')).toBe('misread');
  });

  it('⭐⭐ and therefore never offers the update', () => {
    expect(shouldOfferPlateUpdate('TR2260', 'FTR2260')).toBe(false);
  });

  // ⚠️ THE ORDER IS THE FIX. Both hypotheses explain a format change; only one is destructive, so
  // the non-destructive one is tested first and only the residue reaches the shape rule.
  it('⚠️ the real re-plate still classifies as one — this did not blunt the shape rule', () => {
    expect(classifyPlateDifference('0GK641', 'LZM500')).toBe('replate');
    expect(shouldOfferPlateUpdate('0GK641', 'LZM500')).toBe(true);
  });

  it('⚠️ two missing characters is a different failure and is not absorbed here', () => {
    expect(classifyPlateDifference('R2260', 'FTR2260')).toBe('replate');
  });

  it('⚠️ a LONGER tag read than the record is not a truncation', () => {
    expect(classifyPlateDifference('FTR2260', 'TR2260')).toBe('replate');
  });
});
