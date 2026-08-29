import { describe, it, expect } from 'vitest';
import { resolveClassCodePrefix, describePrefixResolution, nearMissClassCode, describeNearMiss } from '../../api/_lib/classCodeCandidates';

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

describe('nearMissClassCode — the failure that actually happens', () => {
  // ⭐⭐⭐ A 25-photo probe on 2026-08-29 found EVERY class code read at exactly four characters —
  // no truncations at all, which is why the prefix route solves a problem that does not occur. But
  // TWO of those 25 disagreed with the stored value, and neither misread is a real code:
  //   LUR278  stored CJCL  read CJCI   (one character, L→I)
  //   HMT717  stored CKSE  read CRSR   (two characters)
  // Both would be logged as unknown, and the teach path would invite Aaron to enshrine them —
  // exactly how CC59, CK45 and CN were born.

  it('⭐ CJCI is one character from CJCL — the real misread, measured', () => {
    const m = nearMissClassCode('CJCI');
    expect(m.suggestion).toBe('CJCL');
    expect(m.candidates).toEqual(['CJCL']);
  });

  it('⚠️⚠️ the nearest code is often the WRONG one — which is why it raises doubt, not a fix', () => {
    // HMT717's CKSE was read as CRSR: two characters from the truth, but ONE character from CRSV,
    // a different car entirely. A "did you mean CRSV?" would be confidently wrong. The message has
    // to be "read the tag again", which is true in both cases.
    const m = nearMissClassCode('CRSR');
    expect(m.candidates).toEqual(['CRSV']);
    expect(describeNearMiss(m)).toMatch(/read the tag again before teaching it as new/);
    expect(describeNearMiss(m)).not.toMatch(/did you mean/i);
  });

  it('⭐ stays silent on a code FG already knows — there is nothing to rescue', () => {
    expect(nearMissClassCode('CJCL')).toMatchObject({ suggestion: null, candidates: [] });
    expect(nearMissClassCode('CRVB')).toMatchObject({ suggestion: null, candidates: [] });
  });

  it('⚠️ NEVER PICKS between two codes a single character away', () => {
    // CKSR sits one character from BOTH CKSE and CKSV. The evidence does not settle it, so both are
    // handed back and neither is preferred.
    const m = nearMissClassCode('CKSR');
    expect(m.candidates).toEqual(['CKSE', 'CKSV']);
    expect(m.suggestion).toBeNull();
  });

  it('says nothing about a genuinely new code that resembles nothing', () => {
    expect(nearMissClassCode('ZZZZ')).toMatchObject({ suggestion: null, candidates: [] });
  });

  it('only considers full-length reads — a truncation is the prefix route\'s job', () => {
    expect(nearMissClassCode('CJC')).toMatchObject({ suggestion: null, candidates: [] });
    expect(nearMissClassCode('')).toMatchObject({ suggestion: null, candidates: [] });
  });

  it('counts a code FG taught itself as known, both as a match and as a candidate', () => {
    expect(nearMissClassCode('CTMY', ['CTMY']).candidates).toEqual([]);   // known → nothing to say
    expect(nearMissClassCode('QQAC', ['QQAB']).suggestion).toBe('QQAB');  // taught → a candidate
  });

  it('normalizes first, as every codex entry point does', () => {
    expect(nearMissClassCode('  cjci 25 ').suggestion).toBe('CJCL');
  });
});

describe('describeNearMiss', () => {
  it('names what he may have meant, and never what FG did about it', () => {
    expect(describeNearMiss(nearMissClassCode('CJCI')))
      .toBe("CJCI isn't a code FG knows, and it's one character from CJCL — read the tag again before teaching it as new");
  });

  it('lists both when it cannot choose', () => {
    expect(describeNearMiss(nearMissClassCode('CKSR'))).toMatch(/one character from CKSE and CKSV/);
  });

  it('says nothing when there is nothing to say', () => {
    expect(describeNearMiss(nearMissClassCode('ZZZZ'))).toBe('');
  });
});
