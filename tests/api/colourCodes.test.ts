// ⚠️⚠️ THE ONE THING A TEST *CAN* HOLD ABOUT A VISION PROMPT.
//
// `ticket-tag-colour-codes.md` says the gate is structurally blind here: a prompt change passes
// every test and can still be wrong, because only a real send against a real tag proves the model
// behaves. True — and it does not mean nothing is testable. **What a test can pin is that we never
// again teach a code the tags do not print.**
//
// The bug: both prompts mapped `GRY→Gray` and `BLK→Black`. Aaron, in one line — *"tags use GRA for
// Gray and GRE for Green"*. Measured across every row in the fleet: GRA 13, BLA 9, GRE 4, BRO 2,
// PLU 1 — and **GRY 0, BLK 0**. The rule is the FIRST THREE LETTERS of the colour word, and the two
// wrong entries were exactly the two places where the *conventional* abbreviation drops a vowel
// instead of taking the first three characters. Somebody wrote the abbreviations they expected.
//
// ⭐ AND THE CODES LIVED IN TWO PROMPTS, NOT ONE. The ticket named only the key-tag reader; Effie's
// prompt carried the identical GRY/BLK mapping and would have kept teaching it. This file asserts
// BOTH, which is the point — a shared fact duplicated across prompts needs a shared guard.
import { describe, it, expect } from 'vitest';
import { PROMPT as KEYTAG_PROMPT } from '../../api/_lib/keytagReader';
import { SYSTEM_PROMPT as EFFIE_PROMPT } from '../../api/_lib/effiePrompt';

/** Every colour code observed on a real tag in this fleet, with what it expands to. */
const REAL_CODES: [string, string][] = [
  ['WHI', 'White'], ['BLA', 'Black'], ['GRA', 'Gray'], ['GRE', 'Green'],
  ['SIL', 'Silver'], ['BLU', 'Blue'], ['RED', 'Red'], ['BRO', 'Brown'],
  // ⚠️ PLU IS NOT PLUM — corrected 2026-09-20 when Aaron sent Kia's configurator:
  // `exteriorColourCode=PLU` = "Pluton Blue". The code is the first three letters of the
  // MANUFACTURER'S name for the colour, not of a generic colour word. FG had written Plum onto a
  // blue 2025 Seltos (LFJ306). ⭐ Which also kills the "expand an unlisted code by the same rule"
  // line both prompts carried — that rule is exactly what produces Plum.
  ['PLU', 'Blue'],
  // Aaron, 2026-09-25: LUR154 and LUR171 (Kia Seltos) — "those two are actually orange cars".
  ['ORA', 'Orange'],
];

/** Codes the tags do NOT print. Both were in both prompts until 2026-09-18. */
const PHANTOM_CODES = ['GRY', 'BLK'];

const PROMPTS: [string, string][] = [
  ['key-tag reader', KEYTAG_PROMPT],
  ['Effie', EFFIE_PROMPT],
];

describe.each(PROMPTS)('%s prompt — colour codes', (_name, prompt) => {
  it.each(PHANTOM_CODES)('⚠️ never teaches %s — the tags do not print it', code => {
    expect(prompt).not.toContain(`${code}→`);
    expect(prompt).not.toContain(`${code} =`);
  });

  it.each(REAL_CODES)('teaches the real code %s → %s', (code, word) => {
    expect(prompt).toContain(code);
    expect(prompt).toContain(word);
  });

  // ⚠️⚠️ REVERSED 2026-09-20 (`e03334c`). This test used to pin the opposite: that an unlisted code
  // "must still resolve" by the first-three-letters rule. That rule is what wrote PLUM onto a blue
  // Seltos — the letters are the MANUFACTURER'S marketing name, not a colour word. After e03334c
  // the old assertion still passed (the prompt still says FIRST THREE LETTERS, as a description),
  // so it guarded nothing while its name taught the retired rule. Now it pins the rule that holds:
  // an unlisted code comes back AS-IS, and `normalizeTagColour` passes it through untouched.
  it('reports an unlisted code AS-IS — never expands one "by the rule"', () => {
    expect(prompt).toMatch(/unlisted 3-letter code: report it AS-IS/);
    expect(prompt).toMatch(/do NOT guess a colour from the letters/);
    expect(prompt).not.toMatch(/Expand an unlisted/i);
    expect(prompt).toMatch(/FIRST THREE LETTERS/i);
  });

  // ⚠️ GRA/GRE and BLA/BLU are one character apart. The tag is the only authority on colour — a
  // wrong colour comes from a wrong TAG (proven on LZM516/LZM539, where two tags for the same car
  // disagreed), and no amount of looking at the car can be allowed to override the read.
  it('warns that the codes are one character apart and must be READ, not inferred', () => {
    expect(prompt).toMatch(/single character/i);
    expect(prompt).toMatch(/never infer a colour from the car/i);
  });
});

// Aaron, 2026-09-25: LJF700 read "Orange". Its tag prints BLA, and an orange key fob sat in the photo.
describe('key-tag reader — the colour comes from the tag, not the keys', () => {
  it('tells the model never to take the colour from the keys or fob', () => {
    expect(KEYTAG_PROMPT).toMatch(/never from the KEYS or FOB/);
  });
});
