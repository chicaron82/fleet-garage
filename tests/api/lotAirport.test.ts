import { describe, it, expect } from 'vitest';
import { parseReading, readingChange, READING_MAX_AGE_MS, type AirportRow, newerThanHeld } from '../../api/_lib/lotAirport';

const NOW = Date.parse('2026-10-18T17:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const ROW: AirportRow = {
  cleans: 2, cleans_at: iso(5 * 60_000),
  returns: null, returns_at: null,
  aisle: false, aisle_at: null,
};

describe('parseReading', () => {
  it('a notch 0..4 on cleans or returns, 0/1 on the aisle', () => {
    expect(parseReading({ field: 'cleans', value: 4, at: iso(0) }, 'AS', NOW)).toMatchObject({ field: 'cleans', value: 4 });
    expect(parseReading({ field: 'returns', value: 0, at: iso(0) }, 'AS', NOW)).toMatchObject({ field: 'returns', value: 0 });
    expect(parseReading({ field: 'aisle', value: 1, at: iso(0) }, 'AS', NOW)).toMatchObject({ field: 'aisle', value: 1 });
  });
  it('refuses a notch off the page, a made-up field, and a non-integer', () => {
    for (const b of [{ field: 'cleans', value: 5 }, { field: 'aisle', value: 2 }, { field: 'stalls', value: 1 }, { field: 'cleans', value: 1.5 }, { field: 'returns', value: '2' }]) {
      expect(parseReading(b, 'AS', NOW)).toHaveProperty('error');
    }
  });
  it('keeps the time the finger hit the glass', () => {
    expect(parseReading({ field: 'cleans', value: 1, at: iso(10 * 60_000) }, 'AS', NOW)).toMatchObject({ at: iso(10 * 60_000) });
  });
  it('no time means now; a phone clock running ahead is pulled back to now', () => {
    expect(parseReading({ field: 'cleans', value: 1 }, 'AS', NOW)).toMatchObject({ at: iso(0) });
    expect(parseReading({ field: 'cleans', value: 1, at: iso(-60 * 60_000) }, 'AS', NOW)).toMatchObject({ at: iso(0) });
  });
  it('⚠️ a tap older than 12 hours is refused, and a garbage time is refused, never written as now', () => {
    expect(parseReading({ field: 'cleans', value: 1, at: iso(READING_MAX_AGE_MS + 1) }, 'AS', NOW)).toHaveProperty('error');
    expect(parseReading({ field: 'cleans', value: 1, at: 'yesterday-ish' }, 'AS', NOW)).toHaveProperty('error');
  });
});

describe('readingChange — newer wins, by the phone\'s clock', () => {
  it('a newer reading writes the field, its tapper and its tap time', () => {
    const c = readingChange(ROW, { action: 'reading', field: 'cleans', value: 0, at: iso(60_000), by: 'AS' });
    expect(c.patch).toEqual({ cleans: 0, cleans_by: 'AS', cleans_at: iso(60_000) });
    expect(c.tap).toMatchObject({ field: 'cleans', value: 0, prev: 2, applied: true, tapped_at: iso(60_000) });
  });
  it('⭐ a tap that waited for signal and is OLDER than the row is logged but never written', () => {
    const c = readingChange(ROW, { action: 'reading', field: 'cleans', value: 4, at: iso(10 * 60_000), by: 'JD' });
    expect(c.patch).toBeNull();
    expect(c.tap).toMatchObject({ applied: false, value: 4, prev: 2 });
  });
  it('a field never read takes any reading', () => {
    expect(readingChange(ROW, { action: 'reading', field: 'returns', value: 0, at: iso(9 * 60 * 60_000), by: 'AS' }).patch)
      .toEqual({ returns: 0, returns_by: 'AS', returns_at: iso(9 * 60 * 60_000) });
  });
  it('the aisle is stored as a flag and logged as 0/1', () => {
    const c = readingChange(ROW, { action: 'reading', field: 'aisle', value: 1, at: iso(0), by: 'AS' });
    expect(c.patch).toMatchObject({ aisle: true });
    expect(c.tap).toMatchObject({ value: 1, prev: 0 });
  });
  it('each field keeps its own clock: an old cleans tap does not block a new returns tap', () => {
    expect(readingChange(ROW, { action: 'reading', field: 'returns', value: 3, at: iso(60 * 60_000), by: 'AS' }).tap.applied).toBe(true);
  });
});

describe('newerThanHeld — the newer-wins rule inside the UPDATE', () => {
  it('⭐ writes only over a reading that is older, or a field never read', () => {
    expect(newerThanHeld('cleans', '2026-10-18T19:00:00.000Z'))
      .toBe('cleans_at.is.null,cleans_at.lt."2026-10-18T19:00:00.000Z"');
  });
  it('each field checks its own clock', () => {
    expect(newerThanHeld('aisle', '2026-10-18T19:00:00.000Z')).toMatch(/^aisle_at\.is\.null,aisle_at\.lt\./);
  });
});
