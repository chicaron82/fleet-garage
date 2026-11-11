// A past gas sheet on ITS day (src/lib/sheetDay.ts, migration 168). Aaron, 2026-11-09: *"I select a date and whatever I
// enter would write to that date"*. ⚠️ No typed Winnipeg clock here: every time is read back through the app's own
// formatters (feedback: Manitoba kept UTC−5 from 2026-11-01, and tz tables disagree across machines).
import { describe, it, expect } from 'vitest';
import { dayLabel, isSheetDay, odoFit, parseOdo, sheetDayBounds, sheetRowWords, winnipegDay } from '../../src/lib/sheetDay';
import { clockOf } from '../../src/lib/lotBay';

describe('sheetDayBounds: the day, in Winnipeg', () => {
  it.each(['2026-11-07', '2026-11-08', '2026-03-08', '2026-07-01'])('%s: starts at its midnight, reads at its noon, ends at the next midnight', day => {
    const b = sheetDayBounds(day);
    expect(winnipegDay(Date.parse(b.start))).toBe(day);
    // Not "noon minus 12 h": a spring-forward day (Mar 8) is 23 hours long. Midnight is midnight.
    expect(clockOf(b.start)).toBe('00:00');
    expect(winnipegDay(Date.parse(b.readAt))).toBe(day);
    expect(clockOf(b.readAt)).toBe('12:00');
    expect(winnipegDay(Date.parse(b.end) - 1)).toBe(day);
    expect(winnipegDay(Date.parse(b.end))).not.toBe(day);
  });
});

describe('isSheetDay', () => {
  it('today or earlier, never a day that has not happened', () => {
    const now = Date.now();
    const today = winnipegDay(now);
    expect(isSheetDay(today, now)).toBe(true);
    expect(isSheetDay(winnipegDay(now - 2 * 86_400_000), now)).toBe(true);
    expect(isSheetDay(winnipegDay(now + 2 * 86_400_000), now)).toBe(false);
    expect(isSheetDay('', now)).toBe(false);
  });
});

describe('⭐ odoFit: between the readings either side (his guard, 2026-11-10)', () => {
  const before = { km: 45000, at: '2026-11-05T18:00:00Z' };
  const after = { km: 45600, at: '2026-11-09T18:00:00Z' };
  it('in between fits, and says how far since the reading before', () => {
    expect(odoFit(45244, before, after)).toEqual({ kind: 'ok', since: 244 });
    expect(odoFit(45000, before, after)).toEqual({ kind: 'ok', since: 0 });
    expect(odoFit(45600, before, after)).toEqual({ kind: 'ok', since: 600 });
  });
  it('⭐ higher than the LATER reading: one of them is wrong', () => {
    expect(odoFit(45601, before, after).kind).toBe('high');
    expect(odoFit(54387, null, { km: 11245, at: after.at }).kind).toBe('high');
  });
  it('lower than the reading before', () => {
    expect(odoFit(44999, before, after).kind).toBe('low');
  });
  it('with no readings on file anything fits', () => {
    expect(odoFit(12, null, null)).toEqual({ kind: 'ok', since: null });
  });
});

describe('parseOdo', () => {
  it('whole km, commas and spaces allowed', () => {
    expect(parseOdo('48,100')).toBe(48100);
    expect(parseOdo(' 48 100 ')).toBe(48100);
    expect(parseOdo('0')).toBeNull();
    expect(parseOdo('48.1')).toBeNull();
    expect(parseOdo('12345678')).toBeNull();
  });
});

describe('⭐ sheetRowWords: what each row says', () => {
  const sat = '2026-11-07';
  it('his example: Saturday\'s sheet under today\'s newer reading', () => {
    const w = sheetRowWords({ status: 'saved', reading_id: 1, sighting_id: 2, current: false, kept: { km: 48350, at: '2026-11-09T19:00:00Z' } }, 48100, sat);
    expect(w.tone).toBe('ok');
    expect(w.text).toContain(`48,100 on ${dayLabel(sat)}`);
    expect(w.text).toContain('Kept the newer 48,350');
  });
  it('a sheet that is the newest says it is now the car\'s odo', () => {
    expect(sheetRowWords({ status: 'saved', reading_id: 1, sighting_id: null, current: true, kept: null }, 48100, sat).text).toContain("now the car's odo");
  });
  it('a conflict names the reading it disagrees with, and which way', () => {
    const lower = sheetRowWords({ status: 'conflict', before: { km: 49000, at: '2026-11-02T18:00:00Z' }, after: null }, 4810, sat);
    expect(lower.tone).toBe('warn');
    expect(lower.text).toMatch(/read 49,000, higher than this/);
    const higher = sheetRowWords({ status: 'conflict', before: null, after: { km: 47000, at: '2026-11-09T18:00:00Z' } }, 48100, sat);
    expect(higher.text).toMatch(/read 47,000, lower than this/);
  });
  it('already, and a future day', () => {
    expect(sheetRowWords({ status: 'already' }, 1, sat).text).toBe(`Already in for ${dayLabel(sat)}`);
    expect(sheetRowWords({ status: 'future' }, 1, sat).tone).toBe('warn');
  });
});
