// Erin St's count, page side (src/lib/lotBay.ts). Rulings, Aaron 2026-10-15: each count is a snapshot shown with its
// time; amber at 30 min (*"If nothing is being sent up for over 30min. Either we have nothing or drivers are all
// stuck waiting at the airport"*); −1 is "used".
import { describe, it, expect } from 'vitest';
import {
  BAY_STALE_MIN, bayFromRow, bayTapLine, clockOf, isBayStale, isCleansFix, usedToday,
} from '../../src/lib/lotBay';
import { UNDO_MS } from '../../src/lib/lotLookout';
import { businessDateOf } from '../../src/lib/shiftDay';

const NOW = Date.parse('2026-10-15T16:30:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

describe('isBayStale', () => {
  it('fresh up to 30 min, amber past it', () => {
    expect(BAY_STALE_MIN).toBe(30);
    expect(isBayStale(minsAgo(29), NOW)).toBe(false);
    expect(isBayStale(minsAgo(30), NOW)).toBe(false);
    expect(isBayStale(minsAgo(31), NOW)).toBe(true);
  });
  it('a count never set is amber too', () => {
    expect(isBayStale(null, NOW)).toBe(true);
  });
});

describe('usedToday', () => {
  it('counts only the shift-day it belongs to; yesterday\'s reads as 0 with no reset job', () => {
    expect(usedToday({ used: 9, usedOn: businessDateOf(new Date(NOW)) }, NOW)).toBe(9);
    expect(usedToday({ used: 9, usedOn: '2026-10-14' }, NOW)).toBe(0);
    expect(usedToday({ used: 0, usedOn: null }, NOW)).toBe(0);
  });
});

describe('isCleansFix', () => {
  it('a −1 inside 5 s of this phone\'s own +1 fixes a slip', () => {
    expect(isCleansFix(NOW - (UNDO_MS - 1), NOW)).toBe(true);
  });
  it('after 5 s, or with no +1 before it, a −1 is a clean used', () => {
    expect(isCleansFix(NOW - UNDO_MS, NOW)).toBe(false);
    expect(isCleansFix(null, NOW)).toBe(false);
  });
});

describe('clockOf', () => {
  it('Winnipeg time, 24-hour, whatever the phone\'s zone', () => {
    expect(clockOf('2026-10-15T16:58:00Z')).toBe('11:58'); // CDT, UTC−5
    expect(clockOf('2026-10-16T05:05:00Z')).toBe('00:05'); // midnight reads 00, never 24
    expect(clockOf('2026-12-15T16:58:00Z')).toBe('10:58'); // CST, UTC−6
  });
});

describe('bayTapLine', () => {
  it('says what each change was', () => {
    expect(bayTapLine({ kind: 'ready', value: 7 })).toBe('+1 ready · 7 now');
    expect(bayTapLine({ kind: 'used', value: 5 })).toBe('−1 used · 5 now');
    expect(bayTapLine({ kind: 'fix', value: 6 })).toBe('−1 fixed a slip · 6 now');
    expect(bayTapLine({ kind: 'dirties', value: 23 })).toBe('Dirties set to 23');
  });

  it('says what each quick tap was (migration 156)', () => {
    expect(bayTapLine({ kind: 'set', value: 6 })).toBe('Cleans set to 6');
    expect(bayTapLine({ kind: 'drain', value: 6 })).toBe('Drained with the drivers · 6 now');
    expect(bayTapLine({ kind: 'fill', value: 6 })).toBe('Filled from the drivers · 6 dirties');
    expect(bayTapLine({ kind: 'undo', value: 9 })).toBe('Undone · back to 9');
  });
});

describe('bayFromRow', () => {
  it('maps the row', () => {
    expect(bayFromRow({ cleans: 6, cleans_by: 'AS', cleans_at: 'x', dirties: null, dirties_by: null, dirties_at: null, used: 2, used_on: '2026-10-15' }))
      .toEqual({ cleans: 6, cleansBy: 'AS', cleansAt: 'x', dirties: null, dirtiesBy: null, dirtiesAt: null, used: 2, usedOn: '2026-10-15' });
  });
});
