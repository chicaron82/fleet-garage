import { describe, it, expect } from 'vitest';
import { correctManitobaPlate, MB_PLATE_PREFIXES } from '../../../api/_lib/platePrefix';

describe('correctManitobaPlate', () => {
  it('snaps the U-read-as-M/N misreads to the real prefix (the sheet hazard)', () => {
    expect(correctManitobaPlate('KMR250')).toBe('KUR250'); // U→M, the email car
    expect(correctManitobaPlate('LMR150')).toBe('LUR150');
    expect(correctManitobaPlate('LNR118')).toBe('LUR118'); // U→N
    expect(correctManitobaPlate('KNR232')).toBe('KUR232');
  });

  it('handles the LFJ/LJF swap-pair without cross-correcting them', () => {
    expect(correctManitobaPlate('LFJ383')).toBe('LFJ383'); // both are valid, untouched
    expect(correctManitobaPlate('LJF701')).toBe('LJF701');
    expect(correctManitobaPlate('LJT701')).toBe('LJF701'); // one-off from only LJF
    expect(correctManitobaPlate('LFF383')).toBe('LFF383'); // one-off from BOTH → ambiguous, left as-is
  });

  it('leaves an already-valid prefix untouched', () => {
    for (const p of MB_PLATE_PREFIXES) {
      expect(correctManitobaPlate(`${p}383`)).toBe(`${p}383`);
    }
  });

  it('never touches a foreign / out-of-province plate', () => {
    // Real non-MB plates from the inventory sheet — none is one char off a known prefix.
    for (const plate of ['SB264H', 'VR257P', 'OCC267', 'DBHJ179']) {
      expect(correctManitobaPlate(plate)).toBe(plate);
    }
  });

  it('does not guess when a misread is one-off from two prefixes', () => {
    // "MUR" is one char off both LUR (M/L) and KUR (M/K) → ambiguous → leave as-is.
    expect(correctManitobaPlate('MUR250')).toBe('MUR250');
  });

  it('normalizes case and spacing before matching', () => {
    expect(correctManitobaPlate('kmr 250')).toBe('KUR250');
    expect(correctManitobaPlate('  LFJ 383 ')).toBe('LFJ383');
  });

  it('leaves too-short or empty input alone', () => {
    expect(correctManitobaPlate('')).toBe('');
    expect(correctManitobaPlate('LF')).toBe('LF');
  });
});

// ── Pass 2: the body ─────────────────────────────────────────────────────────
// Aaron, 2026-08-21: "since its an MB car, FG knows that LUR is one of the prefixes for MB,
// so it should autocorrect in reading that L as a '1'." A confirmed MB fleet prefix IS the
// province signal, so the three characters behind it must be digits.
describe('correctManitobaPlate — digits behind a confirmed MB prefix', () => {
  it('snaps a letter sitting in a digit position', () => {
    expect(correctManitobaPlate('LURL43')).toBe('LUR143'); // the real 2026-07 duplicate
    expect(correctManitobaPlate('LURI43')).toBe('LUR143');
    expect(correctManitobaPlate('KUR2S0')).toBe('KUR250');
    expect(correctManitobaPlate('LZM5I6')).toBe('LZM516');
    expect(correctManitobaPlate('LFJ3B3')).toBe('LFJ383');
  });

  it('fixes both halves in one pass — bad prefix AND a bad digit', () => {
    expect(correctManitobaPlate('LMRL43')).toBe('LUR143'); // U→M and L→1 together
  });

  it('leaves an already-correct plate alone', () => {
    expect(correctManitobaPlate('LUR143')).toBe('LUR143');
    expect(correctManitobaPlate('LZM516')).toBe('LZM516');
  });

  it('⭐ never touches the body of a foreign plate — the prefix gate is the whole safety net', () => {
    // Out-of-province shapes that contain confusable letters where MB would want digits.
    for (const plate of ['VRS123', 'SBL456', 'OCCB12', 'MURL43', 'ABCS55']) {
      expect(correctManitobaPlate(plate)).toBe(plate);
    }
  });

  it('refuses to half-correct: one unmappable letter means hands off', () => {
    // C has no digit reading, so we do not emit "LUR1A2"-style guesswork.
    expect(correctManitobaPlate('LURCAR')).toBe('LURCAR');
    expect(correctManitobaPlate('LURL4X')).toBe('LURL4X');
  });

  it('leaves a body that is not three characters alone', () => {
    expect(correctManitobaPlate('LUR1433')).toBe('LUR1433');
    expect(correctManitobaPlate('LUR14')).toBe('LUR14');
  });

  it('still normalises case and spacing on the way through', () => {
    expect(correctManitobaPlate(' lurl43 ')).toBe('LUR143');
  });

  it('an ambiguous prefix blocks pass 2 as well', () => {
    // LFF is one-off from BOTH LFJ and LJF, so it is never confirmed MB — body untouched.
    expect(correctManitobaPlate('LFFL43')).toBe('LFFL43');
  });
});
