import { describe, it, expect } from 'vitest';
import { resolveClassCodePrefix, describePrefixResolution } from '../../api/_lib/classPrefix';

// ⭐ AARON'S IDEA, after FG taught itself `CN = Nissan Sentra` from a truncated read of `CNSS`:
// "if CN was the only thing that was picked up. what class is it, C? what C class has CN** Sentra!
//  if it were CS** could be a sportage CSPT if Q4, CSEH if a hybrid"
//
// ⚠️ And the fact that makes it worth building: measured 2026-08-28, the number of fleet class codes
// FG does not know is ZERO. Every "unknown code" was a code already in the book, arriving damaged —
// and the old behaviour asked him to TEACH it, which stored the truncation as a new code.

/** The real pin table, trimmed to the Sportages — the case he described. */
const CLASSES = new Map([
  ['CSPT', 'Q4'], ['CSEH', 'E6'], ['CSEN', 'C'], ['CSLE', 'R'],
  ['CSBZ', 'T6'], ['CNSS', 'C'], ['CTMY', 'E9'], ['CTM3', 'E7'],
]);

describe('resolveClassCodePrefix — the unique block', () => {
  it('⭐ CN resolves to CNSS — the exact truncation that became a bogus codex entry', () => {
    const r = resolveClassCodePrefix('CN', null, CLASSES);
    expect(r.resolved).toBe('CNSS');
    expect(r.narrowedBy).toBe('unique');
  });

  it('resolves without needing a rental class when only one candidate exists', () => {
    expect(resolveClassCodePrefix('CN', 'ANYTHING', CLASSES).resolved).toBe('CNSS');
  });
});

describe('resolveClassCodePrefix — the second source on the same tag', () => {
  it('⭐⭐ CS + Q4 is the petrol Sportage; CS + E6 is the hybrid — exactly as he described', () => {
    expect(resolveClassCodePrefix('CS', 'Q4', CLASSES).resolved).toBe('CSPT');
    expect(resolveClassCodePrefix('CS', 'E6', CLASSES).resolved).toBe('CSEH');
    expect(resolveClassCodePrefix('CS', 'E6', CLASSES).narrowedBy).toBe('rentalClass');
  });

  it('⚠️ hands back the candidates rather than guessing when nothing narrows', () => {
    const r = resolveClassCodePrefix('CS', null, CLASSES);
    expect(r.resolved).toBeNull();
    expect(r.candidates.length).toBeGreaterThan(1);
    expect(r.candidates).toContain('CSPT');
    expect(r.candidates).toContain('CSEH');
  });

  it('⚠️ a rental class that narrows to NOTHING leaves it unresolved, never eliminates wrongly', () => {
    const r = resolveClassCodePrefix('CS', 'ZZ', CLASSES);
    expect(r.resolved).toBeNull();
    expect(r.candidates.length).toBeGreaterThan(1);
  });

  it('⚠️ a rental class shared by two candidates does not resolve either', () => {
    // CTMY is a TAUGHT code, not curated, so it has to be supplied to be a candidate at all —
    // which makes this a test of both the tie and the taught-codes path.
    const tie = new Map([['CTMY', 'E9'], ['CTM3', 'E9']]);
    const r = resolveClassCodePrefix('CTM', 'E9', tie, ['CTMY']);
    expect(r.candidates).toEqual(['CTM3', 'CTMY']);
    expect(r.resolved).toBeNull();
  });
});

describe('resolveClassCodePrefix — what is not a prefix', () => {
  it('⚠️ refuses a single character — C matches the whole chart and resolves nothing', () => {
    expect(resolveClassCodePrefix('C', 'Q4', CLASSES)).toMatchObject({ resolved: null, candidates: [] });
  });

  it('⚠️ refuses a FULL four-character code — that is a code, not a prefix', () => {
    // Resolving it here would let a wrong four-character read quietly become a different code.
    expect(resolveClassCodePrefix('CSPT', 'Q4', CLASSES)).toMatchObject({ resolved: null, prefix: '' });
  });

  it('returns an empty resolution for junk rather than throwing', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(resolveClassCodePrefix(bad, 'Q4', CLASSES).resolved, `${bad}`).toBeNull();
    }
  });

  it('normalises the way every other codex entry point does', () => {
    expect(resolveClassCodePrefix('  cn 25 ', null, CLASSES).resolved).toBe('CNSS');
  });
});

describe('resolveClassCodePrefix — the taught codes count too', () => {
  it('includes a code FG taught itself, not only the curated map', () => {
    const r = resolveClassCodePrefix('ZZ', null, new Map(), ['ZZTOP']);
    expect(r.candidates).toEqual([]);   // ZZTOP is 5 chars — not a code
    const ok = resolveClassCodePrefix('QQ', null, new Map(), ['QQAB']);
    expect(ok.resolved).toBe('QQAB');
  });

  it('says so plainly when a prefix matches nothing FG knows', () => {
    const r = resolveClassCodePrefix('QQ', null, CLASSES);
    expect(r).toMatchObject({ resolved: null, candidates: [] });
    expect(describePrefixResolution(r)).toMatch(/matches no code FG knows/);
  });
});

describe('describePrefixResolution', () => {
  it('names the evidence, so a deduction never reads as a reading', () => {
    expect(describePrefixResolution(resolveClassCodePrefix('CN', null, CLASSES)))
      .toBe('CN… is only ever CNSS');
    expect(describePrefixResolution(resolveClassCodePrefix('CS', 'E6', CLASSES)))
      .toBe('CS… with that rental class is CSEH');
  });

  it('lists the options when it cannot choose', () => {
    expect(describePrefixResolution(resolveClassCodePrefix('CS', null, CLASSES)))
      .toMatch(/^CS… could be /);
  });

  it('says nothing at all about an unusable input', () => {
    expect(describePrefixResolution(resolveClassCodePrefix('C', null, CLASSES))).toBe('');
  });
});
