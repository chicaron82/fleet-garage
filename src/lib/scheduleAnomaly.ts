// "Your week breaks your own pattern" — the forward-looking sibling of scheduleInsights.
// Aaron's tell (2026-07-16): "i've had to remind myself a few times this week already that i
// only have saturday off." He was doing the check in his head, repeatedly. FG already holds the
// schedule; this makes it KNOW instead of him recalling.
//
// The baseline is his DECLARED work week (Aaron 2026-07-17: "mon-fri is my work week. deviations
// from it i'd like surfaced"). It was ORIGINALLY inferred from his last-12-weeks history — but that
// self-maintaining property is a LIABILITY under sustained coverage churn: enough boss-shuffled
// Wednesdays and the history would quietly decide "Wednesday-off is normal now" and stop flagging
// it, even though his contract never changed. A declared week can't erode — a deviation stays a
// deviation forever. History is kept ONLY for the evidence line ("you've had 11 of 12 Suns off"),
// never for the decision, so a thin/no-history weekday still fires correctly.
//
// Deliberately DAY-anomaly, never shift-TYPE anomaly. His shift types genuinely rotate — the boss
// runs him opening/closing/clopen/double — so a "your pattern changed" alert keyed on type would
// fire constantly and train him to ignore it (Aaron 2026-07-17: "my shift window keeps rotating so
// i can't have FG tell me if something's off from the norm since its always up in the air").
//
// One classification, TWO TONES (Aaron's refinement — I'd framed it as pure risk; he was right that
// good news is worth knowing too):
//   * working a normally-off day → ⚠️ he might not show up. Costly.
//   * off on a normally-worked day → 🎉 don't set the alarm. A gift, not a warning.
import { isFullDayShift } from '../types';
import type { ShiftType } from '../types';
import type { ScheduleInsight } from './scheduleInsights';

/** One day of the lookahead: what he's scheduled for, whether that weekday is part of his
 *  declared work week, and the history for the evidence copy. */
export interface AnomalyDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** 'Sun' … 'Sat' — for the copy. */
  dayName: string;
  /** How many days from today (1 = tomorrow). Drives "tomorrow" vs the day name. */
  daysAway: number;
  shiftType: ShiftType;
  /** From his DECLARED work week (Mon–Fri = true, weekend = false) — the anchor that decides
   *  whether working/off is an anomaly. Set by the hook, never inferred here. */
  normalWorkday: boolean;
  /** History for the EVIDENCE copy only, never the decision: days off / days seen for THIS
   *  weekday over the baseline window. */
  offCount: number;
  sampleSize: number;
}

/** Below this many observations, don't CITE the history in the copy — the decision is declared so
 *  it still fires, we just won't claim "N of M" off a thin sample. */
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
 *
 * `nagBudget` bounds which days may SURFACE an alert (Aaron's nag budget — far enough to act on,
 * close enough it never becomes wallpaper). It does NOT bound the off-block COUNT: pass a longer
 * `days` array than the budget and a 4-day break still reads "4 days off in a row" while only its
 * first day (inside the budget) surfaces. Default Infinity = every passed day may surface.
 */
export function scheduleAnomalies(days: AnomalyDay[], nagBudget = Number.POSITIVE_INFINITY): ScheduleInsight[] {
  const out: ScheduleInsight[] = [];

  days.forEach((d, i) => {
    // Past the nag budget: don't SHOUT about it yet — but it still counted toward any off-block
    // that started inside the budget (offBlockLength scans the whole array below).
    if (d.daysAway > nagBudget) return;

    // ⚠️ Working a day he's normally OFF (a weekend) — the one that costs something if missed.
    if (worked(d) && !d.normalWorkday) {
      out.push({
        kind: 'anomaly-working',
        icon: '⚠️',
        label: d.daysAway === 1 ? `You work tomorrow — ${d.dayName}` : `You work ${d.dayName}`,
        // Cite the history when it's trustworthy; otherwise lean on the declared week.
        detail: d.sampleSize >= MIN_SAMPLE
          ? `You've had ${d.offCount} of the last ${d.sampleSize} ${d.dayName}s off.`
          : `${d.dayName} isn't part of your usual Mon–Fri week.`,
      });
      return;
    }

    // 🎉 Off on a day he normally works (Mon–Fri) — don't set the alarm.
    if (!worked(d) && d.normalWorkday) {
      // Only the FIRST day of an off-block speaks, or a 3-day break would say it three times.
      const prevIsOff = i > 0 && !worked(days[i - 1]);
      if (prevIsOff) return;
      const block = offBlockLength(days, i);
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
