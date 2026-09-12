import { useState } from 'react';
import { shiftDateStr } from '../lib/shiftDay';

/**
 * ⭐⭐ "PEEK AT THE DAY" — he shows up when he is not rostered, and FG went quiet exactly then.
 *
 * Aaron, 2026-09-12: *"when i'm not scheduled... if i popped in with tomek on saturday's shift i
 * could capture the gas sheets for odo readings. and it wouldn't show. what about a toggle to 'peak
 * at the day'... showing the cars i updated. instead of who's on shift with me to who's on shift
 * right now."*
 *
 * ⭐ A TOGGLE, not always-on. The quiet default is the POINT — a day off should not greet him with
 * work cards, and he guards his time off deliberately. This is him choosing to open the day.
 *
 * ⚠️ Scoped to the SHIFT day and deliberately not a saved preference: a peek is an act, not a
 * setting, and one left switched on would turn every day off into a work screen — the exact thing
 * the gating exists to prevent. sessionStorage keyed by shift date, so it survives navigating away
 * and back and is gone at the 04:00 rollover. Wrapped because private mode can throw on access.
 */
export function usePeekAtTheDay() {
  const key = `fg.peek.${shiftDateStr(0)}`;
  const [peeking, setPeeking] = useState(() => {
    try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
  });
  const toggle = () => setPeeking(prev => {
    const next = !prev;
    try {
      if (next) sessionStorage.setItem(key, '1');
      else sessionStorage.removeItem(key);
    } catch { /* private mode — the peek just won't survive navigation */ }
    return next;
  });
  return { peeking, toggle };
}
