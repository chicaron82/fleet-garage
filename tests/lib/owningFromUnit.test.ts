import { describe, it, expect } from 'vitest';
import {
  owningFromUnit,
  describeOwningGuess,
  UNIT_PREFIX_LEN,
  type UnitOwningVehicle,
} from '../../src/lib/owningFromUnit';

// Aaron, working the audit queue: "anything with unit number 542**** or 549**** enter owning 8199,
// vancouver 8191 and so on. the ones that i'll stop on are ones i'm unsure of."
//
// ⚠️ The ambiguity is REAL, measured on the live fleet 2026-08-28: 26 of 29 prefixes map to one
// branch and three do not — 577 is 6× Calgary / 1× Winnipeg, 586 is 3/1, 711 is 1/1. Those minority
// rows came off SCANNED TAGS, so they are the truth, not dirt. Hence: suggest, tally, never fill.

const car = (unitNumber: string, owningArea: string | null): UnitOwningVehicle => ({ unitNumber, owningArea });
const many = (n: number, base: number, area: string) =>
  Array.from({ length: n }, (_, i) => car(String(base + i), area));

describe('owningFromUnit — the confident block', () => {
  const fleet = many(20, 5420000, '8199');

  it('⭐ suggests the branch when the whole block agrees', () => {
    const g = owningFromUnit('5429999', fleet);
    expect(g.suggestion).toBe('8199');
    expect(g.prefix).toBe('542');
    expect(g.ambiguous).toBe(false);
    expect(g.seen).toBe(20);
  });

  it('reads the prefix off the digits, ignoring a stored space', () => {
    // 0EL762 carries "4374 7498"; a unit is not always clean.
    const g = owningFromUnit('542 9999', fleet);
    expect(g.prefix).toBe('542');
    expect(g.suggestion).toBe('8199');
  });
});

describe('owningFromUnit — the blocks he should stop on', () => {
  it('⭐ still suggests at 6-of-7 but reports the dissent — the 577 case', () => {
    const fleet = [...many(6, 5774000, '8193'), car('5777685', '8199')];
    const g = owningFromUnit('5775000', fleet);
    expect(g.suggestion).toBe('8193');
    expect(g.ambiguous).toBe(true);
    expect(g.tally).toEqual([{ owningArea: '8193', count: 6 }, { owningArea: '8199', count: 1 }]);
  });

  it('⭐⭐ suggests NOTHING on an even split — the 711 case', () => {
    // One and one. A silent autofill here would have written the wrong branch and stamped it
    // 'manual', locked, from a tap he made without looking.
    const fleet = [car('7112642', '8198'), car('7117997', '8199')];
    const g = owningFromUnit('7115000', fleet);
    expect(g.suggestion).toBeNull();
    expect(g.ambiguous).toBe(true);
    expect(g.seen).toBe(2);
  });

  it('⚠️ suggests nothing from two agreeing cars — a majority of two is noise', () => {
    const g = owningFromUnit('5990000', [car('5991111', '8190'), car('5992222', '8190')]);
    expect(g.suggestion).toBeNull();
    expect(g.tally).toEqual([{ owningArea: '8190', count: 2 }]);
  });

  it('suggests nothing when FG has never seen the block', () => {
    const g = owningFromUnit('9990000', many(20, 5420000, '8199'));
    expect(g).toMatchObject({ suggestion: null, seen: 0, tally: [], ambiguous: false });
  });
});

describe('owningFromUnit — a record must not corroborate itself', () => {
  it('⭐ excludes the car being audited from its own evidence', () => {
    // Otherwise a wrong value votes for itself, which is invisible until the day it matters.
    const fleet = [car('7112642', '8198'), car('7117997', '8199')];
    const g = owningFromUnit('7112642', fleet, '7112642');
    expect(g.seen).toBe(1);
    expect(g.tally).toEqual([{ owningArea: '8199', count: 1 }]);
  });

  it('excludes it by digits, so a stored space cannot smuggle a vote back in', () => {
    const fleet = [car('4374 7498', '8199'), ...many(5, 4374000, '8193')];
    const g = owningFromUnit('4374 7498', fleet, '43747498');
    expect(g.tally.find(t => t.owningArea === '8199')).toBeUndefined();
  });
});

describe('owningFromUnit — unusable input', () => {
  it('returns an empty guess rather than throwing', () => {
    for (const bad of ['', '  ', null, undefined, '42']) {
      expect(owningFromUnit(bad, many(5, 5420000, '8199')), `${bad}`).toMatchObject({ suggestion: null, seen: 0 });
    }
  });

  it('ignores fleet rows with no owning area — an unknown is not a vote', () => {
    const g = owningFromUnit('5421111', [...many(3, 5420000, '8199'), car('5429999', null)]);
    expect(g.seen).toBe(3);
  });

  it('keys on exactly three digits, as his own examples do', () => {
    expect(UNIT_PREFIX_LEN).toBe(3);
  });
});

describe('describeOwningGuess', () => {
  it('says the whole story in one line when the block agrees', () => {
    expect(describeOwningGuess(owningFromUnit('5429999', many(274, 5420000, '8199'))))
      .toBe('274 of 274 cars on 542 — 8199');
  });

  it('⭐ names the dissent, because that is the part he needs', () => {
    const fleet = [...many(6, 5774000, '8193'), car('5777685', '8199')];
    expect(describeOwningGuess(owningFromUnit('5775000', fleet)))
      .toBe('6 of 7 cars on 577 — 8193 · 1 say 8199');
  });

  it('says nothing when there is nothing to say', () => {
    expect(describeOwningGuess(owningFromUnit('9990000', []))).toBe('');
  });
});
