import { describe, it, expect } from 'vitest';
import { shouldReplaceOdometer, parseOdometer, describeOdometer, describeOdometerAge , odometerUnitFor, checkOdometerJump, classifyOdometerEntry } from '../../src/lib/odometer';

describe('shouldReplaceOdometer — latest wins, but only forward', () => {
  it('fills a blank', () => {
    expect(shouldReplaceOdometer(null, 47200)).toBe(true);
    expect(shouldReplaceOdometer(undefined, 1)).toBe(true);
  });

  it('⭐ accepts a HIGHER reading — the opposite rule to class_code, on purpose', () => {
    // A class code never changes, so first-good-read wins there. An odometer only moves forward,
    // so the newest reading is always the better one.
    expect(shouldReplaceOdometer(47200, 51000)).toBe(true);
  });

  it('⭐ REFUSES a lower reading — that is a misread, not a fact', () => {
    // A transposition (47200 → 42700) or a scan of the wrong car. Refusing costs one skipped
    // update; accepting silently rewrites a good record with a wrong one.
    expect(shouldReplaceOdometer(47200, 42700)).toBe(false);
    expect(shouldReplaceOdometer(47200, 47200)).toBe(false);
  });

  it('refuses junk rather than storing it', () => {
    expect(shouldReplaceOdometer(null, 0)).toBe(false);
    expect(shouldReplaceOdometer(null, -5)).toBe(false);
    expect(shouldReplaceOdometer(null, Number.NaN)).toBe(false);
  });
});

describe('parseOdometer', () => {
  it('takes what he actually types', () => {
    expect(parseOdometer('47200')).toBe(47200);
    expect(parseOdometer('47,200')).toBe(47200);
    expect(parseOdometer(' 47 200 ')).toBe(47200);
  });
  it('rejects anything that is not a plain reading', () => {
    for (const junk of ['', '  ', 'abc', '47.2k', '12345678', null, undefined]) {
      expect(parseOdometer(junk)).toBeNull();
    }
  });
});

describe('describeOdometer — never the number alone', () => {
  const now = new Date(2026, 7, 20);

  it('⭐ always carries the age, because a km reading is a claim about a MOMENT', () => {
    // "47,200 km" from April describes a car that has since done a summer of rentals. Rendering it
    // bare invites a decision on a stale number.
    //
    // ⚠️ `now` IS PASSED EXPLICITLY, and that is the whole point of this file's history: the first
    // version of these two assertions let the function read the real clock. They passed locally at
    // 22:23 CDT and failed in CI at 03:33 UTC — the same instant, the next calendar day — because
    // "8d ago" had become "9d ago". A test that depends on when it runs is not a test.
    expect(describeOdometer(47200, new Date(2026, 7, 12).toISOString(), now)).toBe('47,200 km · 8d ago');
    expect(describeOdometer(47200, new Date(2026, 7, 20).toISOString(), now)).toBe('47,200 km · today');
  });

  it('falls back to a dated stamp once it is genuinely old', () => {
    expect(describeOdometerAge(new Date(2026, 3, 12).toISOString(), now)).toBe('Apr 12');
  });

  it('renders nothing at all when there is nothing to say', () => {
    expect(describeOdometer(null, null, now)).toBe('');
    expect(describeOdometer(0, new Date().toISOString(), now)).toBe('');
  });

  it('survives a reading with no date rather than inventing one', () => {
    expect(describeOdometer(47200, null, now)).toBe('47,200 km');
  });
});

// ── Units, added 2026-08-27 with FG's first US car ────────────────────────────────────────────
describe('odometer units', () => {
  it('reads km by default — the whole Canadian fleet, unchanged', () => {
    expect(odometerUnitFor(false)).toBe('km');
    expect(odometerUnitFor(null)).toBe('km');
    expect(odometerUnitFor(undefined)).toBe('km');
    expect(describeOdometer(16232, null)).toBe('16,232 km');
  });

  it('reads miles for a US car', () => {
    expect(odometerUnitFor(true)).toBe('mi');
    expect(describeOdometer(23175, null, new Date(), 'mi')).toBe('23,175 mi');
  });

  // ⭐⭐⭐ NOTHING IS CONVERTED. 23,175 mi is 37,296 km — if the number ever moved, this would fail.
  // Aaron's rule: the stored figure is what he read off that dash, and the unit only labels it.
  it('never converts the number — the figure is the observation', () => {
    const asMiles = describeOdometer(23175, null, new Date(), 'mi');
    const asKm = describeOdometer(23175, null, new Date(), 'km');
    expect(asMiles).toContain('23,175');
    expect(asKm).toContain('23,175');   // same number, different label — never a conversion
  });

  it('still carries the age, which is the half that stops it aging into a lie', () => {
    const at = new Date('2026-08-20T12:00:00Z').toISOString();
    const now = new Date('2026-08-27T12:00:00Z');
    expect(describeOdometer(23175, at, now, 'mi')).toBe('23,175 mi · 7d ago');
  });
});

// ⚠️⚠️ THE HALF `shouldReplaceOdometer` WAS MISSING. Found 2026-08-31 reading a night's gas-pump
// cards into FG off six photographs: two readings passed the forward-only guard and were about to be
// written. Both are strictly greater than what FG held. Neither is a thing a car can do.
describe('checkOdometerJump', () => {
  const NOW = new Date('2026-08-31T20:00:00-05:00');
  const today = '2026-08-31T12:00:00-05:00';

  it('⭐ catches the one that nearly landed: +49,407 in a day', () => {
    const f = checkOdometerJump(92249, 42842, today, NOW);
    expect(f).not.toBeNull();
    expect(f!.delta).toBe(49407);
    expect(f!.detail).toMatch(/49,407 km in the same day/);
  });

  it('⭐ and the quieter one: +6,440 in a day', () => {
    expect(checkOdometerJump(14224, 7784, today, NOW)).not.toBeNull();
  });

  // ⚠️⚠️ THE CASE THAT SETS THE THRESHOLD, and it is real. MCM563 was plated 2026-08-27 and read
  // 3,154 km four days later — 787 km/day, confirmed by Aaron. A rule tight enough to call that
  // wrong is worse than no rule at all.
  it('⚠️ says NOTHING about MCM563 — 3,149 km in four days is real', () => {
    expect(checkOdometerJump(3154, 5, '2026-08-27T15:03:00-05:00', NOW)).toBeNull();
  });

  it('⚠️ nor about ordinary rental use', () => {
    expect(checkOdometerJump(23043, 22840, '2026-08-29T09:00:00-05:00', NOW)).toBeNull();
  });

  // ⚠️ NO DATE MEANS NO DIVISOR. Guessing an age would manufacture the exact confidence this exists
  // to withhold.
  it('⚠️ is silent when the stored reading has no date', () => {
    expect(checkOdometerJump(92249, 42842, null, NOW)).toBeNull();
    expect(checkOdometerJump(92249, 42842, 'not-a-date', NOW)).toBeNull();
  });

  it('⚠️ is silent on a first reading — nothing to compare against', () => {
    expect(checkOdometerJump(115840, null, today, NOW)).toBeNull();
    expect(checkOdometerJump(115840, undefined, null, NOW)).toBeNull();
  });

  // The forward-only rule already owns a lower number; this must not double-report it.
  it('⚠️ leaves a LOWER reading to shouldReplaceOdometer', () => {
    expect(checkOdometerJump(28921, 34028, today, NOW)).toBeNull();
    expect(checkOdometerJump(6282, 6282, today, NOW)).toBeNull();
  });

  // ⚠️ A FLOOR OF ONE DAY. Two readings an hour apart would otherwise divide by ~0.04 and call any
  // change impossible — and a car genuinely can be driven between a morning flip and an afternoon one.
  it('⚠️ an hour apart is still judged against a full day', () => {
    const anHourAgo = new Date(NOW.getTime() - 3_600_000).toISOString();
    expect(checkOdometerJump(1200, 0, anHourAgo, NOW)).toBeNull();   // 1,200 in a day: fast, allowed
    expect(checkOdometerJump(9000, 0, anHourAgo, NOW)).not.toBeNull();
  });

  it('spreads a big delta over a long gap without complaining', () => {
    // 40,000 km since April is ~300/day — a hard-worked rental, not a misread.
    expect(checkOdometerJump(60000, 20000, '2026-04-01T09:00:00-05:00', NOW)).toBeNull();
  });
});

// ── classifyOdometerEntry ────────────────────────────────────────────────────────────────────
//
// One vocabulary for the control and the write, so neither re-derives "is this allowed?" from raw
// comparisons and drifts from the other — the way the button's `<` once disagreed with the write's
// `<=` and produced a success message for a write that never happened (2026-08-26).
describe('classifyOdometerEntry', () => {
  it('calls a first reading FIRST, not forward — there is nothing to move forward from', () => {
    expect(classifyOdometerEntry(null, 28921)).toBe('first');
    expect(classifyOdometerEntry(undefined, 28921)).toBe('first');
  });

  it('separates forward, same and lower', () => {
    expect(classifyOdometerEntry(28921, 34028)).toBe('forward');
    expect(classifyOdometerEntry(28921, 28921)).toBe('same');
    expect(classifyOdometerEntry(34028, 28921)).toBe('lower');
  });

  // ⚠️ 'lower' is NOT 'invalid', and the distinction is the whole feature. A lower number has two
  // causes the value cannot separate — a misread (common) or a wrong record (Aaron's LFJ180: 34,028
  // on file off a gas sheet, 28,921 on the dash, a trip meter transcribed without its decimal).
  // Naming it 'lower' rather than 'invalid' is what leaves room for the surface to ask him which.
  it('does not condemn a lower reading — it only names it', () => {
    expect(classifyOdometerEntry(34028, 28921)).not.toBe('invalid');
  });

  it('rejects what is not a reading at all', () => {
    for (const bad of [null, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(classifyOdometerEntry(28921, bad as number | null)).toBe('invalid');
    }
  });

  it('rejects a nonsense value even on a car with nothing on file', () => {
    expect(classifyOdometerEntry(null, 0)).toBe('invalid');
  });
});

// ── the jump guard, in the unit the dash is actually showing ─────────────────────────────────
//
// Aaron, 2026-09-01: "FG now has 2 US plated vehicles" — a statement of fact that exposed a bug.
// `checkOdometerJump` was written on 2026-08-31, the day AFTER FG met its first US car, and
// hardcoded km anyway: it compared a MILEAGE delta against a km/day ceiling and printed "km" over
// a number that was never km.
//
// ⚠️ Third instance of this same miss in this file's history — the record chip learned "mi" on
// 2026-08-27 while the input control beside it still said "km on the dash". A unit is part of the
// number, not a display detail.
describe('checkOdometerJump — units', () => {
  const storedAt = '2026-08-30T12:00:00Z';
  const now = new Date('2026-08-31T12:00:00Z');   // exactly one day later

  it('warns in KILOMETRES for a Canadian car, and says km', () => {
    const j = checkOdometerJump(21600, 20000, storedAt, now, 'km');
    expect(j).not.toBeNull();
    expect(j!.detail).toContain('km a day');
    expect(j!.detail).not.toContain('mi');
  });

  // ⭐ 1,000 mi/day is ~1,609 km/day — implausible by the same real-world standard the km ceiling
  // encodes. Under the old code this passed silently, because 1,000 is below the km threshold of
  // 1,500. The guard was ~60% too lax on exactly the cars FG has fewest readings for.
  it('CATCHES a mileage jump that a km ceiling would have waved through', () => {
    const j = checkOdometerJump(24175, 23175, storedAt, now, 'mi');
    expect(j).not.toBeNull();
    expect(j!.detail).toContain('mi a day');
    // the same numbers read as km are genuinely plausible, and must stay silent
    expect(checkOdometerJump(24175, 23175, storedAt, now, 'km')).toBeNull();
  });

  it('never prints the wrong unit — the one message whose job is catching a wrong number', () => {
    const j = checkOdometerJump(30000, 23175, storedAt, now, 'mi');
    expect(j!.detail).toMatch(/^\+6,825 mi in the same day — about 6,825 mi a day/);
  });

  it('defaults to km, which is right for all but a handful of cars', () => {
    expect(checkOdometerJump(21600, 20000, storedAt, now)!.detail).toContain('km a day');
  });

  // The mile ceiling must be the SAME REAL SPEED, not a second invented number — 1500 km/day is
  // about 932 mi/day, so a mileage rate just under that stays quiet and just over it warns.
  it('uses the same real-world speed in both units, not a second invented threshold', () => {
    expect(checkOdometerJump(23175 + 900, 23175, storedAt, now, 'mi')).toBeNull();
    expect(checkOdometerJump(23175 + 960, 23175, storedAt, now, 'mi')).not.toBeNull();
  });
});
