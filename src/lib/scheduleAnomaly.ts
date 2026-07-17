// "Your week breaks your own pattern" — the forward-looking sibling of scheduleInsights.
// Aaron's tell (2026-07-16): "i've had to remind myself a few times this week already that i
// only have saturday off." He was doing the check in his head, repeatedly. FG already holds the
// schedule; this makes it KNOW instead of him recalling.
//
// The baseline is HIS OWN HISTORY, not a declared config: over the last N weeks, how often was a
// given weekday a day off? Self-maintaining (no setting to drift), and it lets the copy show its
// work ("you've had 11 of the last 12 Sundays off") instead of asserting a "pattern" it guessed.
//
// Deliberately DAY-anomaly, never shift-TYPE anomaly. His shift types genuinely rotate — the boss
// runs him opening/closing/clopen/double — so a "your pattern changed" alert keyed on type would
// fire constantly and train him to ignore it. Days-off is his stable axis (12/12 Saturdays off,
// 11/12 Sundays, over 12 weeks): a real signal that can't false-positive.
//
// One detection, TWO TONES (Aaron's refinement — I'd framed it as pure risk; he was right that
// good news is worth knowing too):
//   * working a normally-off day → ⚠️ he might not show up. Costly.
//   * off on a normally-worked day → 🎉 don't set the alarm. A gift, not a warning.
import { isFullDayShift } from '../types';
import type { ShiftType } from '../types';
import type { ScheduleInsight } from './scheduleInsights';

/** One day of the lookahead: what he's scheduled for, and what that weekday usually is. */
export interface AnomalyDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** 'Sun' … 'Sat' — for the copy. */
  dayName: string;
  /** How many days from today (1 = tomorrow). Drives "tomorrow" vs the day name. */
  daysAway: number;
  shiftType: ShiftType;
  /** Baseline from his own history: days off / days seen for THIS weekday. */
  offCount: number;
  sampleSize: number;
}

/** A weekday counts as "normally off" when he's had it off in at least this share of the
 *  baseline window. 0.75 keeps Saturday (12/12) and Sunday (11/12) in, and keeps a Wednesday
 *  he's had off twice in twelve weeks OUT — so a one-off midweek day never reads as "normal". */
const NORMALLY_OFF = 0.75;
/** …and the mirror: a weekday he works at least this often is "normally worked". */
const NORMALLY_WORKED = 0.75;
/** Below this many observations a weekday has no trustworthy baseline — say nothing rather
 *  than claim a pattern from three data points. */
const MIN_SAMPLE = 6;

const worked = (d: AnomalyDay) => !isFullDayShift(d.shiftType);
const whenLabel = (d: AnomalyDay) => (d.daysAway === 1 ? 'tomorrow' : d.dayName);

/**
 * Count the consecutive non-working days starting at `index` — so the copy can say "long
 * weekend" only when the block actually earns it. Honest by construction: it counts what's
 * scheduled, and a lone day off stays a lone day off.
 */
function offBlockLength(days: AnomalyDay[], index: number): number {
  let n = 0;
  for (let i = index; i < days.length && !worked(days[i]); i++) n++;
  return n;
}

/**
 * Anomalies in the lookahead window, as My Day insights. `days` must be consecutive and
 * date-ordered, starting tomorrow. Returns [] for an ordinary week, so the card stays hidden.
 */
export function scheduleAnomalies(days: AnomalyDay[]): ScheduleInsight[] {
  const out: ScheduleInsight[] = [];

  days.forEach((d, i) => {
    if (d.sampleSize < MIN_SAMPLE) return; // no trustworthy baseline — stay quiet
    const offRate = d.offCount / d.sampleSize;

    // ⚠️ Working a day he's normally off — the one that costs something if missed.
    if (worked(d) && offRate >= NORMALLY_OFF) {
      out.push({
        kind: 'anomaly-working',
        icon: '⚠️',
        label: d.daysAway === 1 ? `You work tomorrow — ${d.dayName}` : `You work ${d.dayName}`,
        detail: `You've had ${d.offCount} of the last ${d.sampleSize} ${d.dayName}s off.`,
      });
      return;
    }

    // 🎉 Off on a day he normally works — don't set the alarm.
    if (!worked(d) && offRate <= 1 - NORMALLY_WORKED) {
      const block = offBlockLength(days, i);
      // Only the FIRST day of an off-block speaks, or a 3-day break would say it three times.
      const prevIsOff = i > 0 && !worked(days[i - 1]);
      if (prevIsOff) return;
      out.push({
        kind: 'anomaly-off',
        icon: '🎉',
        label: `No work ${whenLabel(d)}`,
        // "Long weekend" is a DERIVATION, never a label — it only earns the words when the
        // consecutive off-block is really there (pto + day-off both count as not-working).
        detail: block >= 3 ? `${block} days off in a row — enjoy the long weekend.` : `${d.dayName} off — you usually work it.`,
      });
    }
  });

  return out;
}
