import { describe, it, expect } from 'vitest';
import { takeBackLabel, takeBackWords } from '../../src/lib/odometerTakeBack';

// Nov 5 10:14 Winnipeg (UTC−5): LJF712's real reading before the 37,331 slip.
const NOV5 = '2026-11-05T15:14:57.421+00:00';

describe('takeBackLabel', () => {
  it('names the reading it goes back to, with that reading’s own day', () => {
    expect(takeBackLabel({ km: 31656, at: NOV5 }, 'km', false)).toBe('Wrong? Back to 31,656 km (Thu, Nov 5)');
  });
  it('says the second tap is the one that does it', () => {
    expect(takeBackLabel({ km: 31656, at: NOV5 }, 'km', true)).toBe('Tap again: back to 31,656 km');
  });
  it('speaks miles for a US car', () => {
    expect(takeBackLabel({ km: 23175, at: NOV5 }, 'mi', false)).toContain('23,175 mi');
  });
});

describe('takeBackWords', () => {
  it('a take-back says what the odo is again', () => {
    expect(takeBackWords({ status: 'taken_back', km: 31656, at: NOV5 }, 'km'))
      .toEqual({ ok: true, text: 'Taken back: 31,656 km (Thu, Nov 5) is the odo again' });
  });
  it('a reading that landed since is refused, and says nothing moved', () => {
    expect(takeBackWords({ status: 'not_current' }, 'km')).toEqual({ ok: false, text: 'The odo changed since. Nothing was taken back.' });
  });
  it('nothing before it is not a success', () => {
    expect(takeBackWords({ status: 'no_previous' }, 'km').ok).toBe(false);
  });
  it('a call that never answered is a failure, never silence', () => {
    expect(takeBackWords(null, 'km')).toEqual({ ok: false, text: "That didn't take. Check your signal and try again." });
  });
});
