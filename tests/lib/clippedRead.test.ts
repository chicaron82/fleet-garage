import { describe, it, expect } from 'vitest';
import { isClippedRead, isLeadingTruncation, matchByLeadingTruncation } from '../../src/lib/clippedRead';

// FTR2260 / unit 5627245 — the tag whose perforation ate the left column of every line.
const CLIPPED = { unitNumber: '627245', vinLast9: 'SE150006' };   // 6 and 8 — one short each
const WHOLE   = { unitNumber: '5627245', vinLast9: '2SE150006' };

describe('isClippedRead', () => {
  it('⭐ recognises the real tag: unit one digit short AND VIN one character short', () => {
    expect(isClippedRead(CLIPPED)).toBe(true);
  });

  it('says nothing about a complete read', () => {
    expect(isClippedRead(WHOLE)).toBe(false);
  });

  // ⚠️⚠️ THE GUARD THAT MAKES THIS SAFE. One short field is the ordinary bad read — a thumb over the
  // last digit, glare on the VIN line. The confidence comes entirely from TWO independent
  // fixed-length fields agreeing, and loosening this to "either" would route every half-legible tag
  // in the bay down the suffix path.
  it('⚠️⚠️ ONE short field is never enough — that is just a bad read', () => {
    expect(isClippedRead({ unitNumber: '627245', vinLast9: '2SE150006' })).toBe(false);
    expect(isClippedRead({ unitNumber: '5627245', vinLast9: 'SE150006' })).toBe(false);
  });

  it('⚠️ a missing field is not a short field — absence proves nothing', () => {
    expect(isClippedRead({ unitNumber: '627245' })).toBe(false);
    expect(isClippedRead({ vinLast9: 'SE150006' })).toBe(false);
    expect(isClippedRead({})).toBe(false);
  });

  it('⚠️ two characters short is a different failure, not this one', () => {
    expect(isClippedRead({ unitNumber: '27245', vinLast9: 'E150006' })).toBe(false);
  });

  it('reads through the tag’s printed spacing — "562 7245" is seven digits, not eight', () => {
    expect(isClippedRead({ unitNumber: '562 7245', vinLast9: '2SE150006' })).toBe(false);
    expect(isClippedRead({ unitNumber: '62 7245',  vinLast9: 'SE150006'  })).toBe(true);
  });
});

describe('isLeadingTruncation', () => {
  it('⭐ TR2260 is FTR2260 with the F sliced off', () => {
    expect(isLeadingTruncation('TR2260', 'FTR2260')).toBe(true);
  });

  // ⚠️ NOT `endsWith`. The tag loses one COLUMN, so the loss is exactly one character per line;
  // accepting two would widen every match below to strings that share only a tail.
  it('⚠️ exactly one character — two missing is not this failure', () => {
    expect(isLeadingTruncation('R2260', 'FTR2260')).toBe(false);
  });

  it('is not fooled by an equal or longer string', () => {
    expect(isLeadingTruncation('FTR2260', 'FTR2260')).toBe(false);
    expect(isLeadingTruncation('XFTR2260', 'FTR2260')).toBe(false);
  });

  it('is false for two genuinely different plates', () => {
    expect(isLeadingTruncation('LZM500', 'FTR2260')).toBe(false);
    expect(isLeadingTruncation('0GK641', 'LZM500')).toBe(false);
  });

  it('an empty read claims nothing', () => {
    expect(isLeadingTruncation('', 'FTR2260')).toBe(false);
  });

  it('ignores case and the tag’s punctuation', () => {
    expect(isLeadingTruncation('tr2260', 'FTR-2260')).toBe(true);
  });
});

describe('matchByLeadingTruncation', () => {
  const car = (plate: string, unit: string) => ({ licensePlate: plate, unitNumber: unit });
  const fleet = [car('FTR2260', '5627245'), car('LZM500', '5421615'), car('LUR271', '5420001')];

  it('⭐ restores the missing digit and finds the one car that fits', () => {
    const m = matchByLeadingTruncation('627245', fleet, v => v.unitNumber);
    expect(m.kind).toBe('one');
    expect(m.kind === 'one' && m.vehicle.licensePlate).toBe('FTR2260');
  });

  it('⭐ works on the plate too — TR2260 finds FTR2260', () => {
    const m = matchByLeadingTruncation('TR2260', fleet, v => v.licensePlate);
    expect(m.kind === 'one' && m.vehicle.unitNumber).toBe('5627245');
  });

  // ⚠️⚠️ THE LIVE AMBIGUOUS CASE, not a hypothetical: LUR271 and KUR271 are both on the fleet today
  // and both end in UR271. Measuring "762 units, 762 distinct suffixes, zero collisions" proves the
  // rule is exact on TODAY's fleet — it does not make it exact by construction, and the cost of
  // being wrong is a scan attached to the wrong car.
  it('⚠️⚠️ hands back BOTH when a suffix fits two cars — never picks', () => {
    const m = matchByLeadingTruncation('UR271', [car('LUR271', '5420001'), car('KUR271', '5420002')], v => v.licensePlate);
    expect(m.kind).toBe('ambiguous');
    expect(m.kind === 'ambiguous' && m.vehicles.map(v => v.licensePlate)).toEqual(['LUR271', 'KUR271']);
  });

  it('finds nothing when no car fits, rather than reaching', () => {
    expect(matchByLeadingTruncation('999999', fleet, v => v.unitNumber).kind).toBe('none');
  });

  it('an empty value matches nothing', () => {
    expect(matchByLeadingTruncation('', fleet, v => v.unitNumber).kind).toBe('none');
    expect(matchByLeadingTruncation(null, fleet, v => v.unitNumber).kind).toBe('none');
  });

  it('⚠️ never matches a car whose value is the same length — that is not a truncation', () => {
    expect(matchByLeadingTruncation('LZM500', fleet, v => v.licensePlate).kind).toBe('none');
  });
});
