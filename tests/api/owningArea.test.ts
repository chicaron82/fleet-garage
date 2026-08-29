import { describe, it, expect } from 'vitest';
import { normalizeOwning, owningLabel, isForeignOwning, checkOwningCity, HOME_OWNING } from '../../api/_lib/owningArea';

describe('normalizeOwning', () => {
  it('strips the leading zero the printed tag uses ("08199")', () => {
    expect(normalizeOwning('08199')).toBe('8199');
    expect(normalizeOwning('8199')).toBe('8199');
  });
  it('rejects anything too short to be an owning — a stray digit is not a branch', () => {
    expect(normalizeOwning('81')).toBe('');
    expect(normalizeOwning('')).toBe('');
    expect(normalizeOwning(null)).toBe('');
  });
});

describe('owningLabel', () => {
  it('names the branches Aaron gave', () => {
    expect(owningLabel('08199')).toBe('Winnipeg (8199)');
    expect(owningLabel('8193')).toBe('Calgary (8193)');
    expect(owningLabel('8191')).toBe('Vancouver (8191)');
    expect(owningLabel('8197')).toBe('Toronto (8197)');
  });

  it('⭐ shows an UNKNOWN owning as the bare number rather than guessing a branch', () => {
    // New branches appear and codes rotate; inventing a name would be worse than showing digits.
    expect(owningLabel('8123')).toBe('8123');
  });

  it('⭐ still names 8999 — Winnipeg\'s owning BEFORE the renumber', () => {
    // Aaron started under 8999/589xxxx/592xxxx. Historical cars must not read as a foreign branch.
    // Named plainly — the number distinguishes it from 8199 without a stuttering label.
    expect(owningLabel('8999')).toBe('Winnipeg (8999)');
  });
});

describe('isForeignOwning', () => {
  it('is quiet for the home branch — 8199 on every scan would be noise', () => {
    expect(isForeignOwning('8199')).toBe(false);
    expect(isForeignOwning(HOME_OWNING)).toBe(false);
  });

  it('⭐ flags another branch — the input to the keep-and-reflip decision', () => {
    // Aaron's example: unit 5780176 / plate 0HC124, a Calgary car sitting in the Winnipeg bay.
    expect(isForeignOwning('8193')).toBe(true);
    expect(isForeignOwning('8191')).toBe(true);
  });

  it('⭐ does NOT treat 8999 as foreign — it is Winnipeg under the old numbering', () => {
    expect(isForeignOwning('8999')).toBe(false);
  });

  it('⭐ absent owning is NOT foreign — most of the fleet predates this capture', () => {
    // Every car registered before today reads empty. Flagging those would make the signal useless
    // exactly when the field is newest — same rule as never-seen not being stale.
    expect(isForeignOwning('')).toBe(false);
    expect(isForeignOwning(null)).toBe(false);
    expect(isForeignOwning(undefined)).toBe(false);
  });
});

// Codes that were live in the fleet but displaying as bare numbers until 2026-08-21. Each was
// CONFIRMED rather than guessed: 8190 and 8194 from the plate formats their cars carry (111AAA
// Saskatchewan, AAA1111 Quebec), and 8890 read straight off two stored key tags — "VAN DTG / 08890".
describe('owningLabel — the codes named 2026-08-21', () => {
  it('names Saskatchewan, Montreal and Vancouver-DTG', () => {
    expect(owningLabel('8190')).toBe('Saskatchewan (8190)');
    expect(owningLabel('8194')).toBe('Montreal (8194)');
    expect(owningLabel('8890')).toBe('Vancouver (8890)');
  });

  it('keeps the two Vancouver codes apart by number, not by a qualifier', () => {
    expect(owningLabel('8191')).toBe('Vancouver (8191)');
    expect(owningLabel('08890')).toBe('Vancouver (8890)');   // tags print the leading zero
  });

  it('still refuses to name a code nobody has confirmed', () => {
    expect(owningLabel('8123')).toBe('8123');
  });
});

// ⭐ WHY THE CROSS-CHECK EXISTS. Aaron read three stored key tags on 2026-08-28 and found three
// owning areas wrong — a HALIFAX tag stored as 8199, and two CALGARY tags stored as 8199. Each is a
// single-character misread (8↔9, 3↔9) landing on the fleet's dominant value, which is 284 of 365 and
// structurally permanent because the branch is in Manitoba. A misread toward the majority is one
// more vote FOR the majority, so no frequency-based check can ever see it. The city is the only
// independent evidence on the tag, and FG was reading that line and throwing half of it away.

describe('checkOwningCity — the three real errors', () => {
  it('⭐ HALIFAX + 8199 is a conflict — the exact HNM262 case', () => {
    const r = checkOwningCity('HALIFAX', '8199');
    expect(r.kind).toBe('conflict');
    if (r.kind === 'conflict') expect(r.expected).toContain('8198');
  });

  it('⭐ CALGARY + 8199 is a conflict — 0HC674 and 0ET191', () => {
    expect(checkOwningCity('CALGARY', '8199').kind).toBe('conflict');
  });

  it('agrees when the tag is internally consistent', () => {
    expect(checkOwningCity('WINNIPEG', '8199').kind).toBe('agree');
    expect(checkOwningCity('HALIFAX', '8198').kind).toBe('agree');
    expect(checkOwningCity('CALGARY', '8193').kind).toBe('agree');
  });
});

describe('checkOwningCity — one city, several numbers', () => {
  it('⭐ accepts BOTH Winnipeg numbers — 8999 is the pre-renumber one', () => {
    // A hand-written city→number map would have had to remember this. Deriving it from KNOWN means
    // it cannot drift from the names FG already displays.
    expect(checkOwningCity('WINNIPEG', '8999').kind).toBe('agree');
    expect(checkOwningCity('WINNIPEG', '8199').kind).toBe('agree');
  });

  it('accepts both Vancouver numbers — 8191 and the Dollar/Thrifty 8890', () => {
    expect(checkOwningCity('VANCOUVER', '8191').kind).toBe('agree');
    expect(checkOwningCity('VANCOUVER', '8890').kind).toBe('agree');
  });
});

describe('checkOwningCity — unknown is never disagreement', () => {
  it('⚠️ says nothing about a city string FG cannot name', () => {
    // The 8890 tags print "VAN DTG", which is not the string "Vancouver". Flagging it would warn
    // him about a tag he read perfectly — the same defect as the model-code shape rule.
    expect(checkOwningCity('VAN DTG', '8890')).toEqual({ kind: 'unknown' });
    expect(checkOwningCity('FARGO', '2294')).toEqual({ kind: 'unknown' });
  });

  it('says nothing when either half is missing — a cut-off city is not a conflict', () => {
    expect(checkOwningCity('', '8199')).toEqual({ kind: 'unknown' });
    expect(checkOwningCity('HALIFAX', '')).toEqual({ kind: 'unknown' });
    expect(checkOwningCity(null, null)).toEqual({ kind: 'unknown' });
  });

  it('says nothing about an owning number too short to be one', () => {
    expect(checkOwningCity('HALIFAX', '819')).toEqual({ kind: 'unknown' });
  });
});

describe('checkOwningCity — reads the tag as printed', () => {
  it('is case- and space-insensitive on the city', () => {
    expect(checkOwningCity('  calgary  ', '8193').kind).toBe('agree');
  });

  it('⭐ strips the printed leading zero before comparing — tags print 08199', () => {
    expect(checkOwningCity('WINNIPEG', '08199').kind).toBe('agree');
    expect(checkOwningCity('HALIFAX', '08199').kind).toBe('conflict');
  });
});

describe('owningLabel — the branch Aaron confirmed tonight', () => {
  it('names Halifax now that he read it off the tag', () => {
    expect(owningLabel('8198')).toBe('Halifax (8198)');
  });

  it('⚠️ still shows an unconfirmed branch as a bare number rather than a guess', () => {
    expect(owningLabel('2294')).toBe('2294');
    expect(owningLabel('8892')).toBe('8892');
  });
});
