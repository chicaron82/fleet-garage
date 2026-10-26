import type { ExtraBlock, Shift } from '../types';
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

// Deducts the unpaid break from gross clock hours. The ONE break rule: OT, pay and the shift rate
// (shift-metrics.ts) all net their hours through here.
// No break logged → MB standard: 30 min, owed *after* 5h (strictly >).
// A logged break → exactly that, whatever the span. Aaron, 2026-10-22: *"0630-1636 with a shortened
// break of 15m instead of 30m"*. The fixed 30 read that day as 9h36m when he worked 9h51m.
export function netActualHours(grossHrs: number, breakMinutes?: number | null): number {
  if (breakMinutes != null) return Math.max(0, grossHrs - breakMinutes / 60);
  return grossHrs > BREAK_THRESHOLD_HRS ? grossHrs - UNPAID_BREAK_HRS : grossHrs;
}

// The [+] blocks (migration 160): more hours on the same day, after going home and being asked back.
// Aaron, 2026-10-26: 06:45–15:15, then 17:00–21:00 when the closer called in sick. Each block nets on its
// OWN through the standard rule, so a 4h block owes no break and the logged `breakMinutes` stays the
// main block's. An unfinished block (a time still blank) counts nothing.
export function extraBlocksHours(blocks?: ReadonlyArray<ExtraBlock> | null): number {
  return (blocks ?? []).reduce((sum, b) => sum + netActualHours(calcHours(b.start, b.end)), 0);
}

// Net hours worked that day: the main actuals after their break, plus every [+] block.
// The ONE total that OT, the pay estimate and the week cell all read.
export function workedHours(shift: Shift): number {
  const gross = calcHours(shift.actualStartTime, shift.actualEndTime);
  const main  = gross > 0 ? netActualHours(gross, shift.breakMinutes) : 0;
  return main + extraBlocksHours(shift.extraBlocks);
}

// Returns OT hours for a shift. Rules:
//   day-off + actual hours logged  → all net hours are OT
//   isStat                         → all net hours are OT
//   regular shift                  → max(0, netHours - 8)
// Net hours include the [+] blocks: a day is one day for the 8h line, however many stretches it took.
export function calcOT(shift: Shift): number {
  const net = workedHours(shift);
  if (net <= 0) return 0;
  if (isFullDayShift(shift.shiftType) || shift.isStat) return net;
  return Math.max(0, net - 8);
}

/**
 * OT the SCHEDULE already promises, before anything is logged. Aaron, 2026-10-22, about Friday's 12:00–22:00:
 * *"tomorrow's shift is over 8h right? so shouldn't it display how much OT it has?"* `calcOT` reads only
 * actual hours, so a long scheduled shift showed nothing until it had been worked.
 *
 * 0 once actuals exist (then `calcOT` owns the number), and 0 for a full-day type or a stat: the pay
 * estimate books a scheduled stat as holiday hours, not OT, and this must not tell a different story.
 */
export function calcPlannedOT(shift: Shift): number {
  if (shift.actualStartTime && shift.actualEndTime) return 0;
  if (isFullDayShift(shift.shiftType) || shift.isStat) return 0;
  return Math.max(0, netActualHours(calcHours(shift.startTime, shift.endTime), shift.breakMinutes) - 8);
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
