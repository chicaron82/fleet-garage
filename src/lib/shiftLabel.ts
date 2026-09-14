// What a shift actually IS, read off its own clock.
//
// ⚠️⚠️ THE PROBLEM (Aaron, 2026-09-14, importing the first counter schedule). FG stores six shift
// types and the counter runs fourteen shapes, so "closing" ended up meaning three different things
// in one table:
//
//     HIR      → 22:00    all part-time
//     Washbay  → 23:00    and it MOVES with peak season
//     Counter  → 01:00    and it does NOT — *"counter staff don't shift for peak season.
//                         they always end at 1am"*
//
// A 17:30–22:00 evening and a 16:00–01:00 counter close wore the same word. The stored TIMES were
// never wrong; the label was, at exactly the moment it matters — reading a schedule to know when
// somebody is actually there.
//
// ⭐ SO THE LABEL IS DERIVED, NOT STORED. Adding real types to the enum would mean a migration and
// a decision at 73 branch points across 68 files; the distinguishing fact was already sitting in
// the data. Nothing here changes what FG stores — `shift_type` keeps its six values and every
// existing branch keeps working.
//
// ⚠️⚠️ FROM THE TIMES ALONE — deliberately NOT from role, and deliberately NOT from peak season.
//   • Peak season moves the WASHBAY's close and leaves the counter's 01:00 untouched, so a label
//     coupled to the season would start lying about the counter the day the season flips — which
//     Aaron says is about a month out.
//   • A label keyed to role goes stale the moment somebody's role changes. Their clock doesn't.
// Two inputs, no config, nothing to keep in sync.
import { calcHours } from './ot';

export interface ShiftLabel {
  /** The short word for the shape — what it is. */
  label: string;
  /** The distinguishing fact, when there is one ("to 1am"). Empty when the word says it all. */
  detail: string;
  /** Does this shift run past midnight? The fact "closing" was hiding. */
  overnight: boolean;
}

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** "01:00" → "1am", "22:00" → "10pm", "17:30" → "5:30pm". The end time as he'd say it. */
export function spokenTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 || h === 24 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

/** Anything starting at or before this is an open. 06:30 and 07:00 both qualify; 08:30 does not. */
const OPEN_BY = toMin('07:30');
/** Anything ending at or after this is a close of some kind — HIR's 22:00 included. */
const CLOSE_FROM = toMin('20:00');

/**
 * Name a shift from its own clock.
 *
 * ⚠️ ORDER MATTERS: overnight is tested FIRST, because a shift ending at 01:00 has an end time that
 * looks like an early morning and would otherwise read as an "open". That inversion is the entire
 * bug this file exists for — the counter close's end time is *numerically* the smallest on the
 * sheet and it is the latest finish in the building.
 */
export function shiftLabel(startTime?: string | null, endTime?: string | null): ShiftLabel {
  if (!startTime || !endTime) return { label: '', detail: '', overnight: false };
  const s = toMin(startTime), e = toMin(endTime);
  const overnight = calcHours(startTime, endTime) > 0 && e < s;

  if (overnight) return { label: 'Close', detail: `to ${spokenTime(endTime)}`, overnight: true };
  if (e >= CLOSE_FROM) return { label: 'Close', detail: `to ${spokenTime(endTime)}`, overnight: false };
  if (s <= OPEN_BY) return { label: 'Open', detail: '', overnight: false };
  return { label: 'Day', detail: '', overnight: false };
}

/** One string, for a chip or a row: "Close · to 1am". */
export function shiftLabelText(startTime?: string | null, endTime?: string | null): string {
  const { label, detail } = shiftLabel(startTime, endTime);
  if (!label) return '';
  return detail ? `${label} · ${detail}` : label;
}
