import { describe, it, expect } from 'vitest';
import { normalizeVinLast9 } from '../../api/_lib/vinLast9';

// ── The guard now on every VIN write path (2026-09-13) ───────────────────────────────────────────
// Until today `normalizeVinLast9` guarded the SCAN and the MODEL read only. The three paths a PERSON
// types into — keytag audit, field editor, register — wrote whatever they were handed, which is how
// LFJ400's tag value got into the database twice.
describe('the value the guard exists to refuse', () => {
  it('⭐⭐ refuses LFJ400\'s tag value — the real defect, twice written', () => {
    // The tag PRINTS this. It is the correct characters sliced one position too far left: it took
    // the check digit's left-hand neighbour and dropped the trailing 0.
    expect(normalizeVinLast9('VXSL47717')).toBe('');
  });

  it('⭐ accepts the value read off the windshield', () => {
    // 3N1CP5CVXSL477170 — last 9. Check digit X is legal; year code S = 2025, and FG has it as 2025.
    expect(normalizeVinLast9('XSL477170')).toBe('XSL477170');
  });

  it('⚠️ the off-by-one is only catchable when the borrowed character is ILLEGAL', () => {
    // This is why the guard caught LFJ400 by luck. Shift a VIN whose neighbour is a DIGIT and the
    // result still passes — nine legal characters, wrong window, silently wrong year code.
    expect(normalizeVinLast9('XSL477170')).toBeTruthy();   // correct slice
    expect(normalizeVinLast9('7XSL47717')).toBeTruthy();   // shifted, and still accepted
  });

  it('refuses the other malformed values on the live fleet', () => {
    expect(normalizeVinLast9('S17793886')).toBe('');       // LUR173 — S cannot be a check digit
  });

  it('refuses the wrong length, and anything outside the VIN alphabet', () => {
    expect(normalizeVinLast9('XSL47717')).toBe('');        // 8 chars
    expect(normalizeVinLast9('XSL4771700')).toBe('');      // 10 chars
    expect(normalizeVinLast9('XSLI77170')).toBe('XSL177170'); // I→1 is a CORRECTION, not a guess
  });

  it('⚠️ refusing returns empty — never write it, or a bad VIN erases a good one', () => {
    // The guard's contract: falsy means SKIP THE FIELD. Writing '' would blank a correct value to
    // "save" an incorrect one, which is strictly worse than doing nothing.
    expect(normalizeVinLast9('VXSL47717') || null).toBeNull();
  });
});
