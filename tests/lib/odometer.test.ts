import { describe, it, expect } from 'vitest';
import { shouldReplaceOdometer, parseOdometer, describeOdometer, describeOdometerAge , odometerUnitFor } from '../../src/lib/odometer';

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
