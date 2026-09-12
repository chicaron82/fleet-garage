import { describe, it, expect } from 'vitest';
import {
  onLotState, onLotLabel, offersOnLotCheck, nextOnLotObservation, type OnLotObservation,
} from '../../src/lib/onLotObservation';

/**
 * ⭐ Aaron, 2026-09-12: *"if it's present on the lot tick the box. else unchecked its either been
 * rented out between my shifts or sent to the bodyshop"* — and the worked example behind it is
 * LUR527: hail-flagged Sep 2, released for rent with no release logged, driven 291 km, back on the
 * 8th. FG could only ever have known by him looking.
 */
const obs = (present: boolean | null, checkedAt: string | null): OnLotObservation => ({ present, checkedAt });

describe('three states, because "gone" and "unlooked-at" are different facts', () => {
  it('null is unchecked — nobody has looked', () => {
    expect(onLotState(obs(null, null))).toBe('unchecked');
  });

  it('confirmed present', () => {
    expect(onLotState(obs(true, '2026-09-10T18:00:00Z'))).toBe('present');
  });

  it('⭐ looked and it was NOT there — the state a lone boolean would lose', () => {
    expect(onLotState(obs(false, '2026-09-10T18:00:00Z'))).toBe('absent');
  });

  it('a value with no date is not an observation', () => {
    // A tick without a moment is exactly the rot the date exists to prevent.
    expect(onLotState(obs(true, null))).toBe('unchecked');
  });
});

describe('the label never claims the car is gone', () => {
  it('carries the date on a confirmation', () => {
    const l = onLotLabel(obs(true, '2026-09-10T18:00:00Z'));
    expect(l).toMatch(/^On the lot · checked /);
    expect(l).toMatch(/Sep/);
  });

  it('⚠️ phrases the negative as an OBSERVATION, not a conclusion', () => {
    const l = onLotLabel(obs(false, '2026-09-10T18:00:00Z'));
    expect(l).toMatch(/^Not on the lot when checked /);
    // Out on rent / at the bodyshop / not looked at are indistinguishable from FG's side, so no
    // wording may assert where the car actually is.
    expect(l).not.toMatch(/gone|missing|absent|lost/i);
  });

  it('says plainly when nobody has looked', () => {
    expect(onLotLabel(obs(null, null))).toBe('Not checked');
    expect(onLotLabel(obs(null, null))).not.toMatch(/gone|missing/i);
  });

  it('survives a junk timestamp without rendering "Invalid Date"', () => {
    expect(onLotLabel(obs(true, 'not-a-date'))).toBe('On the lot · checked ');
  });
});

describe('who gets the control', () => {
  it('only a car FG believes is HELD', () => {
    expect(offersOnLotCheck('HELD')).toBe(true);
  });

  it('⭐ never an exception car — it is EXPECTED to be away', () => {
    expect(offersOnLotCheck('OUT_ON_EXCEPTION')).toBe(false);
  });

  it('not a released or rentable car', () => {
    for (const s of ['CLEAR', 'PRE_EXISTING', 'SALE_CAR', 'RETURNED', 'AUCTION_SHORT_TERM', null, undefined]) {
      expect(offersOnLotCheck(s)).toBe(false);
    }
  });
});

describe('each tap is a new observation, not an edit', () => {
  const NOW = new Date('2026-09-12T15:30:00Z');

  it('unchecked → present (he is standing in front of it)', () => {
    expect(nextOnLotObservation(obs(null, null), NOW)).toEqual({ present: true, checkedAt: NOW.toISOString() });
  });

  it('present → absent (gone one day, so he unticks)', () => {
    expect(nextOnLotObservation(obs(true, '2026-09-10T18:00:00Z'), NOW))
      .toEqual({ present: false, checkedAt: NOW.toISOString() });
  });

  it('absent → present (it came back and the issue persists)', () => {
    expect(nextOnLotObservation(obs(false, '2026-09-10T18:00:00Z'), NOW))
      .toEqual({ present: true, checkedAt: NOW.toISOString() });
  });

  it('⚠️ the timestamp always moves — re-confirming the same state is still a NEW look', () => {
    const first = nextOnLotObservation(obs(false, '2026-09-01T18:00:00Z'), new Date('2026-09-11T10:00:00Z'));
    const again = nextOnLotObservation(first, NOW);
    expect(again.checkedAt).toBe(NOW.toISOString());
    expect(again.checkedAt).not.toBe(first.checkedAt);
  });
});
