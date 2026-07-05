import { describe, it, expect } from 'vitest';
import { correctManitobaPrefix, MB_PLATE_PREFIXES } from '../../../api/_lib/platePrefix';

describe('correctManitobaPrefix', () => {
  it('snaps the U-read-as-M/N misreads to the real prefix (the sheet hazard)', () => {
    expect(correctManitobaPrefix('KMR250')).toBe('KUR250'); // U→M, the email car
    expect(correctManitobaPrefix('LMR150')).toBe('LUR150');
    expect(correctManitobaPrefix('LNR118')).toBe('LUR118'); // U→N
    expect(correctManitobaPrefix('KNR232')).toBe('KUR232');
  });

  it('leaves an already-valid prefix untouched', () => {
    for (const p of MB_PLATE_PREFIXES) {
      expect(correctManitobaPrefix(`${p}383`)).toBe(`${p}383`);
    }
  });

  it('never touches a foreign / out-of-province plate', () => {
    // Real non-MB plates from the inventory sheet — none is one char off a known prefix.
    for (const plate of ['SB264H', 'VR257P', 'OCC267', 'DBHJ179']) {
      expect(correctManitobaPrefix(plate)).toBe(plate);
    }
  });

  it('does not guess when a misread is one-off from two prefixes', () => {
    // "MUR" is one char off both LUR (M/L) and KUR (M/K) → ambiguous → leave as-is.
    expect(correctManitobaPrefix('MUR250')).toBe('MUR250');
  });

  it('normalizes case and spacing before matching', () => {
    expect(correctManitobaPrefix('kmr 250')).toBe('KUR250');
    expect(correctManitobaPrefix('  LFJ 383 ')).toBe('LFJ383');
  });

  it('leaves too-short or empty input alone', () => {
    expect(correctManitobaPrefix('')).toBe('');
    expect(correctManitobaPrefix('LF')).toBe('LF');
  });
});
