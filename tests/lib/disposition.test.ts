import { describe, it, expect } from 'vitest';
import {
  DISPOSITIONS, DISPOSITION_LABELS, DISPOSITION_LONG,
  isDisposition, describeDisposition,
} from '../../src/lib/disposition';

// Aaron, 2026-09-02, while specifying the closing inventory: three kinds of car are never written
// up — sale, turnback and buy-back — and FG could only see one, so any exclusion it performed was
// one third complete while looking total. "what about putting turn back and buy backs as a type
// under sale car when flagging".

describe('the three names for one behaviour', () => {
  it('offers exactly sale, turnback and buyback, common one first', () => {
    expect(DISPOSITIONS).toEqual(['sale', 'turnback', 'buyback']);
  });

  // ⭐ TB / BB rather than "Turnback" / "Buy-back": those are the letters he would write on a key
  // tag, and a tile in his own shorthand reads faster than one in mine.
  it('labels the chips in his shorthand', () => {
    expect(DISPOSITION_LABELS).toEqual({ sale: 'Sale', turnback: 'TB', buyback: 'BB' });
  });

  it('spells them out where there is room', () => {
    expect(DISPOSITION_LONG.buyback).toBe('Buy-back');
  });
});

// ⚠️⚠️ THE BACKWARDS-COMPATIBILITY RULE, and it is the whole reason nothing already filed changed
// meaning: every sale_car hold written before migration 136 has a NULL here.
describe('a sale_car hold with no disposition', () => {
  it('reads as a plain sale', () => {
    expect(describeDisposition(null)).toBe('Sale car');
    expect(describeDisposition(undefined)).toBe('Sale car');
    expect(describeDisposition('')).toBe('Sale car');
  });

  // An unrecognised value falls back the same way rather than rendering a raw string at him —
  // "Sale car" is wrong in a small, safe direction; "leaseback" on a chip is wrong in a loud one.
  it('falls back rather than rendering an unknown value', () => {
    expect(describeDisposition('leaseback')).toBe('Sale car');
  });

  it('names the ones it knows', () => {
    expect(describeDisposition('turnback')).toBe('Turnback');
    expect(describeDisposition('buyback')).toBe('Buy-back');
  });
});

describe('isDisposition', () => {
  it('accepts the three and nothing else', () => {
    for (const d of DISPOSITIONS) expect(isDisposition(d)).toBe(true);
    for (const bad of [null, undefined, '', 'SALE', 'turn-back', 'buy back', 'sale_car']) {
      expect(isDisposition(bad)).toBe(false);
    }
  });

  // ⚠️ Case-sensitive on purpose. The value is written by this app and read by this app; loosening
  // it would invite a second spelling to exist, which is exactly what one column of three fixed
  // labels is meant to prevent.
  it('does not quietly accept a different casing', () => {
    expect(isDisposition('Turnback')).toBe(false);
  });
});
