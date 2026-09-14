import type { Shift } from '../types';
import { isFullDayShift } from '../types';

// Manitoba labour standard: one unpaid 30-min break owed on shifts ≥ 5h.
// Mirrors BREAK_MIN_SPAN_HOURS / UNPAID_BREAK_HOURS in shift-metrics.ts.
export const BREAK_THRESHOLD_HRS = 5;
export const UNPAID_BREAK_HRS    = 0.5;

// Exported so `payEstimate` can compare a scheduled time to an actual one. It normalises as a
// side effect — "06:45" (what a type="time" input writes) and "06:45:00" (what the `time` column
// reads back) both land on 6.75 — so equality must go through here, never through string ===.
export function timeToDec(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

export function calcHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const s = timeToDec(start);
  let e = timeToDec(end);
  if (e < s) e += 24; // midnight crossover e.g. 22:00–00:30; equal = data-entry slip, not 24h
  return Math.max(0, e - s);
}

// Deducts the unpaid break from gross clock hours when the span qualifies.
// MB standard: break owed *after* 5h (strictly >), matching shift-metrics.ts.
export function netActualHours(grossHrs: number): number {
  return grossHrs > BREAK_THRESHOLD_HRS ? grossHrs - UNPAID_BREAK_HRS : grossHrs;
}

// Returns OT hours for a shift. Rules:
//   day-off + actual hours logged  → all net hours are OT
//   isStat                         → all net hours are OT
//   regular shift                  → max(0, netHours - 8)
export function calcOT(shift: Shift): number {
  const gross = calcHours(shift.actualStartTime, shift.actualEndTime);
  if (gross <= 0) return 0;
  const net = netActualHours(gross);
  if (isFullDayShift(shift.shiftType) || shift.isStat) return net;
  return Math.max(0, net - 8);
}

/**
 * Is this a time span a person could not have worked? — the ONE definition, beside `calcHours`.
 *
 * ⚠️⚠️ THE BUG THIS REPLACES (Aaron, 2026-09-14, 00:31, logging the night he came in to lock up).
 * He clocked **23:08 → 00:11** and the sheet refused him: *"Actual end time must be after start
 * time."* — while the summary directly beneath it read **"1h 3m actual · 1h 3m OT"**, correctly.
 * One panel computing a span with `calcHours` (which wraps midnight) and another validating it with
 * a raw string compare, `"23:08" >= "00:11"`. **Two pieces of code answering one question and
 * disagreeing**, and the wrong one held the Save button.
 *
 * ⭐ The rule is NOT "end must be later than start" — a closing shift that runs past midnight is
 * ordinary here, and the peak-season default already ends at 23:00. The only span nobody works is a
 * span of ZERO, which `calcHours` has always named in its own comment: *"equal = data-entry slip,
 * not 24h."* So that is the whole check.
 *
 * ⚠️ It deliberately does NOT reject a long span. A typo'd 09:00–08:00 now reads as 23h rather than
 * erroring — and that is the better failure, because the summary prints "23h" in front of him where
 * a refusal printed nothing and blocked a true entry. Loud and wrong beats silent and right-ish.
 */
export function invalidTimeSpan(start?: string, end?: string): boolean {
  if (!start || !end) return false;   // absence is the required-field check's job, not this one
  return calcHours(start, end) === 0;
}

export function fmtHours(h: number): string {
  if (h === 0) return '0h';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}
