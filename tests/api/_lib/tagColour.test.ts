import { describe, it, expect } from 'vitest';
import { normalizeTagColour, TAG_COLOUR_CODES } from '../../../api/_lib/tagColour';

/**
 * ⚠️ A line-check on 2026-09-20 found 31 live cars holding a raw tag code in `vehicles.color` —
 * rendering as *"2026 Kia Seltos · BLA"* on the Holds list. The mapping had only ever existed as a
 * line in the key-tag reader's PROMPT, which the model usually — but not always — followed.
 */
describe('the codes we can vouch for', () => {
  it('expands the plain ones', () => {
    expect(normalizeTagColour('WHI')).toBe('White');
    expect(normalizeTagColour('BLA')).toBe('Black');
    expect(normalizeTagColour('GRA')).toBe('Gray');
    expect(normalizeTagColour('SIL')).toBe('Silver');
    expect(normalizeTagColour('BLU')).toBe('Blue');
    expect(normalizeTagColour('RED')).toBe('Red');
  });

  it('is case-insensitive — a reader may hand back either', () => {
    expect(normalizeTagColour('gra')).toBe('Gray');
    expect(normalizeTagColour(' Bla ')).toBe('Black');
  });

  it('leaves a value that is already a word alone', () => {
    for (const word of ['White', 'Black', 'Gray', 'Silver', 'Blue', 'Red', 'Green', 'Brown']) {
      expect(normalizeTagColour(word)).toBe(word);
    }
  });
});

/**
 * ⭐⭐⭐ THE ONE THAT COST A WRONG RECORD. The first version of this module DERIVED its table from a
 * list of colour words — "a code is the first three letters of a colour" — which felt principled and
 * was a guess in a rule's clothing. Aaron answered it with Kia's own configurator:
 * `exteriorColourCode=PLU` → **Pluton Blue**. The code is the first three letters of the
 * MANUFACTURER'S MARKETING NAME, not of a generic colour, and the derivation had written **Plum**
 * onto a blue 2025 Seltos (LFJ306).
 */
describe('PLU is Pluton Blue, not Plum', () => {
  it('maps to Blue', () => {
    expect(normalizeTagColour('PLU')).toBe('Blue');
  });

  it('never yields Plum from a code', () => {
    expect(Object.values(TAG_COLOUR_CODES)).not.toContain('Plum');
  });
});

/**
 * ⚠️⚠️ THE GUARD THAT REPLACES THE DERIVATION. A generated table carried TAN, MAR, ORA, BEI, GOL,
 * PIN, PUR, YEL and CHA — none ever seen on an FG tag, each a landmine of the same shape: TAN would
 * swallow *Tangerine*, MAR would swallow *Marine Blue*. A code earns a place by being SEEN and
 * confirmed against the actual car.
 */
describe('what it refuses to guess', () => {
  it('holds only the evidenced codes — no speculative entries', () => {
    expect(Object.keys(TAG_COLOUR_CODES).sort())
      .toEqual(['BLA', 'BLU', 'BRO', 'GRA', 'GRE', 'PLU', 'RED', 'SIL', 'WHI']);
  });

  // ⭐ These two were pulled out in an over-correction after PLU proved wrong, then restored when
  // Aaron confirmed them against the actual cars: *"everything else remains the same."* Green not
  // Grey, Brown not Bronze. One bad inference does not discredit its neighbours.
  it('GRE is Green and BRO is Brown — confirmed against the cars', () => {
    expect(normalizeTagColour('GRE')).toBe('Green');
    expect(normalizeTagColour('BRO')).toBe('Brown');
  });

  it('passes any unknown value through untouched, code-shaped or not', () => {
    expect(normalizeTagColour('TAN')).toBe('TAN');
    expect(normalizeTagColour('MAR')).toBe('MAR');
    expect(normalizeTagColour('TEAL-ISH')).toBe('TEAL-ISH');
  });

  it('treats blank and missing as nothing', () => {
    for (const v of ['', '   ', null, undefined]) expect(normalizeTagColour(v)).toBeUndefined();
  });
});
