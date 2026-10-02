import { describe, it, expect } from 'vitest';
import { isClippedRead, isLeadingTruncation, matchByLeadingTruncation, isClippedForm, matchClippedRead } from '../../src/lib/clippedRead';

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

// FWC4510 / unit 5601463 (2026-10-01) — a Montreal Trax, same perforation, and the reader's ACTUAL
// answer for the photo stored on the car: it INVENTED the unit's missing first digit.
const FWC_READ = { unitNumber: '6601463', vinLast9: 'TC128877', classCode: 'TXF' };

describe('isClippedRead — any two of three fixed-length fields', () => {
  it('⭐⭐ a guessed unit digit no longer hides the clip: last-9 AND code are each one short', () => {
    expect(isClippedRead(FWC_READ)).toBe(true);
  });

  it('unit + code, with no last-9 read at all, is also proof', () => {
    expect(isClippedRead({ unitNumber: '60 1463', classCode: 'TXF' })).toBe(true);
  });

  it('⚠️⚠️ ONE short field is still never enough — whichever one it is', () => {
    expect(isClippedRead({ unitNumber: '5601463', vinLast9: '6TC128877', classCode: 'TXF' })).toBe(false);
    expect(isClippedRead({ unitNumber: '5601463', vinLast9: 'TC128877', classCode: 'CTXF' })).toBe(false);
    expect(isClippedRead({ unitNumber: '601463', vinLast9: '6TC128877', classCode: 'CTXF' })).toBe(false);
    expect(isClippedRead({ classCode: 'TXF' })).toBe(false);
  });

  it('⚠️ a code two characters short, or too long, is not this failure', () => {
    expect(isClippedRead({ vinLast9: 'TC128877', classCode: 'XF' })).toBe(false);
    expect(isClippedRead({ vinLast9: 'TC128877', classCode: 'CTXFF' })).toBe(false);
  });
});

describe('isClippedForm — the first character is not evidence', () => {
  it('restores a missing first character', () => {
    expect(isClippedForm('WC4510', 'FWC4510')).toBe(true);
    expect(isClippedForm('60 1463', '5601463')).toBe(true);
  });

  it('⭐ ignores a first character the reader supplied', () => {
    expect(isClippedForm('6601463', '5601463')).toBe(true);
    expect(isClippedForm('TWC4510', 'FWC4510')).toBe(true);
  });

  it('⚠️ everything after the first character must match exactly', () => {
    expect(isClippedForm('6601464', '5601463')).toBe(false);
    expect(isClippedForm('C4510', 'FWC4510')).toBe(false);     // two short
    expect(isClippedForm('FWC45100', 'FWC4510')).toBe(false);  // longer
    expect(isClippedForm('', 'FWC4510')).toBe(false);
    expect(isClippedForm('F', 'FF')).toBe(false);               // one character names nothing
    expect(isClippedForm('WC4510', null)).toBe(false);
  });
});

describe('matchClippedRead — three keys that may rescue each other and may not disagree', () => {
  type Car = { id: string; unit: string; vin?: string; plate: string };
  const keys = (c: Car) => c;
  const TRAX: Car = { id: 'trax', unit: '5601463', vin: '6TC128877', plate: 'FWC4510' };
  const OTHER: Car = { id: 'other', unit: '5421615', vin: '2SE150006', plate: 'LZM500' };

  it('⭐⭐ finds the car when all three keys name it', () => {
    const m = matchClippedRead({ unit: '6601463', vin: 'TC128877', plates: ['WC4510'] }, [TRAX, OTHER], keys);
    expect(m).toEqual({ kind: 'one', vehicle: TRAX });
  });

  it('one key is enough when the others find nothing', () => {
    const noVin: Car = { ...TRAX, vin: undefined };
    expect(matchClippedRead({ unit: '999999', vin: 'TC128877', plates: ['WC4510'] }, [noVin, OTHER], keys))
      .toEqual({ kind: 'one', vehicle: noVin });
    expect(matchClippedRead({ vin: 'TC128877' }, [TRAX, OTHER], keys)).toEqual({ kind: 'one', vehicle: TRAX });
  });

  // ⚠️⚠️ A clipped read is the weakest evidence FG acts on. Two of its keys pointing at two different
  // cars is not a tie to break by rank; it is a reason to hand both back.
  it('⚠️⚠️ two keys naming two DIFFERENT cars is handed back, never guessed', () => {
    const m = matchClippedRead({ unit: '6601463', plates: ['ZM500'] }, [TRAX, OTHER], keys);
    expect(m).toEqual({ kind: 'ambiguous', vehicles: [TRAX, OTHER] });
  });

  it('an ambiguous key is rescued by one that singles a car out', () => {
    const twin: Car = { id: 'twin', unit: '7601463', plate: 'KUR271' };
    const m = matchClippedRead({ unit: '601463', plates: ['WC4510'] }, [TRAX, twin], keys);
    expect(m).toEqual({ kind: 'one', vehicle: TRAX });
  });

  it('hands back the candidates when nothing singles one out', () => {
    const twin: Car = { id: 'twin', unit: '7601463', plate: 'KUR271' };
    expect(matchClippedRead({ unit: '601463' }, [TRAX, twin], keys)).toEqual({ kind: 'ambiguous', vehicles: [TRAX, twin] });
  });

  it('finds nothing for a car FG does not have, and for an empty read', () => {
    expect(matchClippedRead({ unit: '123456', vin: 'AB123456', plates: ['XX1234'] }, [TRAX, OTHER], keys)).toEqual({ kind: 'none' });
    expect(matchClippedRead({}, [TRAX, OTHER], keys)).toEqual({ kind: 'none' });
    expect(matchClippedRead({ plates: [null, ''] }, [TRAX, OTHER], keys)).toEqual({ kind: 'none' });
  });
});

