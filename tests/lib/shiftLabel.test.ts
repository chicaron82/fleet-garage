import { describe, it, expect } from 'vitest';
import { shiftLabel, shiftLabelText, spokenTime } from '../../src/lib/shiftLabel';

// Every shape below is a REAL span off the Sept–Oct counter sheet, with its live frequency.
// Invented cases would have let me pick the ones the rule already handles.
const REAL: [string, string, number][] = [
  ['09:00', '17:30', 40], ['06:30', '15:00', 36], ['16:00', '01:00', 26], ['16:30', '01:00', 19],
  ['13:30', '22:00', 15], ['06:30', '16:00', 14], ['11:00', '20:30', 9],  ['17:30', '22:00', 9],
  ['07:00', '15:30', 3],  ['17:00', '22:00', 3],  ['08:30', '17:00', 2],  ['06:30', '16:30', 1],
  ['10:00', '16:00', 1],  ['10:00', '18:30', 1],
];

describe('shiftLabel — the three closes', () => {
  // ⚠️⚠️ THE WHOLE POINT. All three wore the word "closing"; only one runs past midnight.
  it('⭐⭐ tells the counter close apart from the other two', () => {
    expect(shiftLabelText('16:00', '01:00')).toBe('Close · to 1am');   // counter — past midnight
    expect(shiftLabelText('14:30', '23:00')).toBe('Close · to 11pm');  // washbay
    expect(shiftLabelText('17:30', '22:00')).toBe('Close · to 10pm');  // HIR, part-time
  });

  it('⭐ marks the overnight one, and only that one', () => {
    expect(shiftLabel('16:00', '01:00').overnight).toBe(true);
    expect(shiftLabel('16:30', '01:00').overnight).toBe(true);
    expect(shiftLabel('14:30', '23:00').overnight).toBe(false);
    expect(shiftLabel('17:30', '22:00').overnight).toBe(false);
  });

  // ⚠️⚠️ THE INVERSION THIS FILE EXISTS FOR. 01:00 is the SMALLEST end time on the sheet and the
  // LATEST finish in the building. Test overnight before anything else or it reads as an open.
  it('⚠️⚠️ never calls a 01:00 finish an "Open" — the smallest end time is the latest one', () => {
    expect(shiftLabel('16:00', '01:00').label).toBe('Close');
    expect(shiftLabel('16:00', '01:00').label).not.toBe('Open');
  });
});

describe('shiftLabel — the rest of the counter sheet', () => {
  it('⭐ names every one of the 14 real shapes, and never blank', () => {
    for (const [s, e, n] of REAL) {
      const { label } = shiftLabel(s, e);
      expect(label, `${s}-${e} (×${n})`).not.toBe('');
      expect(['Open', 'Day', 'Close'], `${s}-${e}`).toContain(label);
    }
  });

  it('opens are the early starts — 06:30 and 07:00, but not 08:30', () => {
    expect(shiftLabel('06:30', '15:00').label).toBe('Open');
    expect(shiftLabel('07:00', '15:30').label).toBe('Open');
    expect(shiftLabel('08:30', '17:00').label).toBe('Day');
  });

  it('the middle of the sheet is a Day, with nothing to add', () => {
    expect(shiftLabelText('09:00', '17:30')).toBe('Day');
    expect(shiftLabelText('10:00', '18:30')).toBe('Day');
    expect(shiftLabelText('10:00', '16:00')).toBe('Day');
  });

  it('11:00–20:30 reads as a close — it ends after eight', () => {
    expect(shiftLabelText('11:00', '20:30')).toBe('Close · to 8:30pm');
  });
});

describe('spokenTime', () => {
  it('says the hour the way he would', () => {
    expect(spokenTime('01:00')).toBe('1am');
    expect(spokenTime('22:00')).toBe('10pm');
    expect(spokenTime('23:00')).toBe('11pm');
    expect(spokenTime('17:30')).toBe('5:30pm');
    expect(spokenTime('12:00')).toBe('12pm');
    expect(spokenTime('00:30')).toBe('12:30am');
  });
});

describe('shiftLabel — edges', () => {
  it('a missing time claims nothing rather than guessing', () => {
    expect(shiftLabel(undefined, '01:00').label).toBe('');
    expect(shiftLabel('16:00', null).label).toBe('');
    expect(shiftLabelText(null, null)).toBe('');
  });

  // ⚠️ A zero span is the data-entry slip lib/ot.ts names; it is not an overnight shift.
  it('⚠️ start === end is not an overnight shift', () => {
    expect(shiftLabel('16:00', '16:00').overnight).toBe(false);
  });

  // ⚠️ Aaron, 2026-09-14: "counter staff don't shift for peak season. they always end at 1am."
  // Nothing here reads a season or a role — same times in, same label out, forever.
  it('⚠️⚠️ is a pure function of two times — no role, no season, no config', () => {
    expect(shiftLabel('16:00', '01:00')).toEqual(shiftLabel('16:00', '01:00'));
    expect(shiftLabelText('16:00', '01:00')).toBe('Close · to 1am');
  });
});
