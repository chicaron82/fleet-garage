import { describe, it, expect } from 'vitest';
import { normalizeTagColour, TAG_COLOUR_CODES, FG_COLOUR_NAMES } from '../../../api/_lib/tagColour';

/**
 * ⚠️ A line-check on 2026-09-20 found 31 live cars holding a raw tag code in `vehicles.color` —
 * GRA ×13, BLA ×9, GRE ×4, BRO ×2, PLU ×1, plus two spelled `Grey`. The Holds list rendered
 * *"2026 Kia Seltos · BLA"* between cars that said Black and Silver. The mapping had only ever
 * existed as a line in the key-tag reader's PROMPT, which the model usually — but not always —
 * followed.
 */
describe('a tag code becomes a word', () => {
  it('expands the codes that were actually found in the fleet', () => {
    expect(normalizeTagColour('GRA')).toBe('Gray');
    expect(normalizeTagColour('BLA')).toBe('Black');
    expect(normalizeTagColour('GRE')).toBe('Green');
    expect(normalizeTagColour('BRO')).toBe('Brown');
    expect(normalizeTagColour('PLU')).toBe('Plum');
  });

  it('is case-insensitive — a reader may hand back either', () => {
    expect(normalizeTagColour('gra')).toBe('Gray');
    expect(normalizeTagColour(' Bla ')).toBe('Black');
  });

  it('leaves a value that is already a word alone', () => {
    for (const name of FG_COLOUR_NAMES) expect(normalizeTagColour(name)).toBe(name);
  });
});

describe('what it refuses to do', () => {
  // ⚠️ Losing an unrecognised colour is worse than showing one. A code nobody expanded is at least
  // visible AS a code; a blank is a fact deleted.
  it('passes an unknown value through untouched', () => {
    expect(normalizeTagColour('TEAL-ISH')).toBe('TEAL-ISH');
    expect(normalizeTagColour('ZZZ')).toBe('ZZZ');
  });

  it('treats blank and missing as nothing', () => {
    for (const v of ['', '   ', null, undefined]) expect(normalizeTagColour(v)).toBeUndefined();
  });
});

/**
 * ⚠️⚠️ THE TEST THAT PROTECTS THE DERIVATION. The codes are generated from the names, so two names
 * sharing a three-letter prefix would give one code two answers — silently, with the last one
 * winning. `Grey` + `Green` is exactly that collision, which is why Aaron's ruling (*"in FG GRA is
 * GRAY"*) is load-bearing rather than cosmetic: his personal spelling stays outside FG so this
 * mapping stays decidable.
 */
describe('the derivation stays unambiguous', () => {
  it('no two colour names share a three-letter prefix', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const name of FG_COLOUR_NAMES) {
      const code = name.slice(0, 3).toUpperCase();
      const prior = seen.get(code);
      if (prior) clashes.push(`${code}: ${prior} vs ${name}`);
      seen.set(code, name);
    }
    expect(clashes).toEqual([]);
  });

  it('every name is reachable from its own code', () => {
    expect(Object.keys(TAG_COLOUR_CODES)).toHaveLength(FG_COLOUR_NAMES.length);
    for (const name of FG_COLOUR_NAMES) expect(TAG_COLOUR_CODES[name.slice(0, 3).toUpperCase()]).toBe(name);
  });

  it('⚠️ adding Grey would break Green — the collision the rule guards against', () => {
    const withGrey = [...FG_COLOUR_NAMES, 'Grey'];
    const codes = withGrey.map(n => n.slice(0, 3).toUpperCase());
    expect(new Set(codes).size).toBeLessThan(withGrey.length);
  });
});
