import type { Shift } from '../types';
import { isFullDayShift } from '../types';
import { calcHours, calcOT, netActualHours } from './ot';

// ── Config ─────────────────────────────────────────────────────────────────────
// Rates and deduction parameters sourced from paystub (PP ending 2026-05-07).
// ⚠️  Update annually each January: CPP/EI rates change on Jan 1 (statutory);
//     tax rate = observed effective rate from most recent paystub.

export const PAY_CONFIG = {
  employeeId:            '331965',
  regularRate:            17.75,
  otRate:                 26.625,   // exactly 1.5×
  cppRate:                0.0595,   // 2026 statutory — update Jan 1
  cppBiweeklyExemption:   134.62,   // $3,500 / 26 periods — update Jan 1
  eiRate:                 0.0163,   // 2026 statutory — update Jan 1
  taxRate:                0.1232,   // observed effective rate (188.00 ÷ 1526.53 regular earnings, stub PP ending 2026-06-18) — refresh from a recent paystub
  anchorPeriodEnd:        '2026-05-07',
  payDayLagDays:          7,        // payroll lag — a period ending Jun 4 pays out Jun 11
  sickDaysEntitlement:    6,        // 48h ÷ 8h; unused days paid out first December payday
} as const;

// Single source of truth for sick entitlement — imported by usePTOStats for the schedule chip.
export const SICK_DAYS_ENTITLEMENT = PAY_CONFIG.sickDaysEntitlement;

// ── Period ─────────────────────────────────────────────────────────────────────

export function getPayPeriod(today: string): { start: string; end: string } {
  const anchor    = new Date(PAY_CONFIG.anchorPeriodEnd + 'T12:00:00');
  const todayDate = new Date(today + 'T12:00:00');

  let periodEnd = new Date(anchor);
  while (periodEnd < todayDate) {
    periodEnd = new Date(periodEnd.getTime() + 14 * 24 * 60 * 60 * 1000);
  }
  const periodStart = new Date(periodEnd.getTime() - 13 * 24 * 60 * 60 * 1000);

  return {
    start: periodStart.toISOString().slice(0, 10),
    end:   periodEnd.toISOString().slice(0, 10),
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// The payday for a pay period = its end date + the payroll lag (PAY_CONFIG).
export function getPayday(period: { end: string }): string {
  return addDays(period.end, PAY_CONFIG.payDayLagDays);
}

// The period whose cheque is NEXT — the most recent period whose payday hasn't
// arrived yet (earned-but-unpaid). Because payroll runs on a lag, in the days
// between a period ending and its payday the just-ended period is the worker's
// "current" cheque, not the calendar period containing today.
//
// The active period is only ever the period containing today or the one before
// it: the containing period's payday is always in the future, and any period
// older than the previous one has already paid. So we just check the previous
// period — if its payday is still today-or-later (inclusive: current THROUGH
// payday, rolls the day after), that's the next cheque; otherwise the containing
// period is.
export function getActivePayPeriod(today: string): { start: string; end: string } {
  const containing = getPayPeriod(today);
  const prevPeriod = { start: addDays(containing.start, -14), end: addDays(containing.end, -14) };
  return getPayday(prevPeriod) >= today ? prevPeriod : containing;
}

export type PeriodConfidence = 'paid' | 'near-final' | 'in-progress' | 'schedule-floor';

// How much to trust a period's number, derived from where today sits relative to
// the period and its payday — NOT from its slot in the card. A fully-past period
// is either already 'paid' or 'near-final' (logged, but the cheque hasn't landed
// yet); a period containing today is 'in-progress'; a fully-future one is a
// 'schedule-floor'.
export function periodConfidence(
  period: { periodStart: string; periodEnd: string },
  today: string,
): PeriodConfidence {
  if (period.periodStart > today) return 'schedule-floor';
  if (period.periodEnd  >= today) return 'in-progress';
  return getPayday({ end: period.periodEnd }) >= today ? 'near-final' : 'paid';
}

// ── Estimate ───────────────────────────────────────────────────────────────────

export interface PayEstimate {
  periodStart:     string;
  periodEnd:       string;
  regularHours:    number;
  otHours:         number;   // real OT on non-stat days
  holidayHours:    number;   // hours worked on a stat (Holiday line, at regularRate)
  holPremGross:    number;   // stat entitlement dollars — worked stat: net×otRate; unworked: 8h×regularRate
  sickPayoutGross: number;   // unused sick days × 8h × regularRate; non-zero only in the Dec payout period
  sickDaysUnused:  number;   // how many of the entitlement days were unused (drives the payout)
  gross:           number;
  cpp:             number;
  ei:              number;
  tax:             number;
  net:             number;
  daysLogged:      number;
  daysConfirmed:   number;
  daysProjected:   number;
  ptoDays:         number;
}

// myShifts should already be filtered to the current user.
// `now` (the real current date) splits unlogged scheduled days: a day strictly
// before `now` already happened → "confirmed" (scheduled = worked); today or
// later → "projected". Defaults to `today` (the period anchor) for callers that
// only care about totals; the card passes the real today so the split is honest.
export function calcPayEstimate(myShifts: Shift[], today: string, sickDaysUsed = 0, now = today): PayEstimate {
  const { start, end } = getPayPeriod(today);

  const periodShifts = myShifts.filter(s => s.date >= start && s.date <= end);

  let regularHours  = 0;
  let otHours       = 0;
  let holidayHours  = 0;
  let holPremGross  = 0;
  let daysLogged    = 0;
  let daysConfirmed = 0;
  let daysProjected = 0;
  let ptoDays       = 0;
  const bumpUnlogged = (date: string) => { if (date < now) daysConfirmed++; else daysProjected++; };

  for (const shift of periodShifts) {
    const hasActual = !!(shift.actualStartTime && shift.actualEndTime);

    if (hasActual) {
      daysLogged++;
      const grossHrs = calcHours(shift.actualStartTime, shift.actualEndTime);
      const net      = netActualHours(grossHrs);
      if (shift.isStat) {
        // Worked stat: Holiday = hours worked (regularRate) + HolPrem = those hours at OT rate (1.5×)
        // — the premium for working a holiday. (Fix 2026-08-04: was a flat 8h×regularRate, which
        // silently dropped the time-and-a-half; the interface already documented net×otRate.)
        holidayHours += net;
        holPremGross += net * PAY_CONFIG.otRate;
      } else {
        const ot = calcOT(shift);
        otHours      += ot;
        regularHours += Math.max(0, net - ot);
      }
    } else if (shift.shiftType === 'pto' || shift.shiftType === 'sick') {
      if (shift.shiftType === 'pto') ptoDays++;
      bumpUnlogged(shift.date);
      regularHours += 8;
    } else if (shift.isStat && !isFullDayShift(shift.shiftType)) {
      // Scheduled WORKED stat (rostered working shift, no actuals yet): Holiday = scheduled hours
      // (regularRate) + HolPrem = those hours at OT rate (1.5×). Mirrors the with-actuals worked-stat
      // branch so a stat you're scheduled to work isn't silently treated as a day off — which dropped
      // ~8h of pay from the estimate (a stat period read LOWER than a normal week). (Fix 2026-08-04.)
      bumpUnlogged(shift.date);
      const net = netActualHours(calcHours(shift.startTime, shift.endTime));
      holidayHours += net;
      holPremGross += net * PAY_CONFIG.otRate;
    } else if (!isFullDayShift(shift.shiftType) && !shift.isStat) {
      // Unlogged working day — scheduled hours (no OT assumed); confirmed if past
      bumpUnlogged(shift.date);
      const scheduled = calcHours(shift.startTime, shift.endTime);
      const net       = netActualHours(scheduled);
      regularHours   += Math.min(net, 8);
    } else if (shift.isStat) {
      // Unworked stat (day-off / full-day type): flat 8h entitlement at regularRate (Holiday = $0)
      holPremGross += 8 * PAY_CONFIG.regularRate;
    }
    // day-off (non-stat): $0
  }

  // Sick day payout: unused entitlement paid out on the first December payday.
  // Trigger: this period contains Dec 1 (year-agnostic).
  const decFirst = `${start.slice(0, 4)}-12-01`;
  const sickDaysUnused    = decFirst >= start && decFirst <= end
    ? Math.max(0, PAY_CONFIG.sickDaysEntitlement - sickDaysUsed)
    : 0;
  const sickPayoutGross   = sickDaysUnused * 8 * PAY_CONFIG.regularRate;

  const gross = regularHours  * PAY_CONFIG.regularRate
              + otHours        * PAY_CONFIG.otRate
              + holidayHours   * PAY_CONFIG.regularRate
              + holPremGross
              + sickPayoutGross;
  const cpp   = Math.max(0, gross - PAY_CONFIG.cppBiweeklyExemption) * PAY_CONFIG.cppRate;
  const ei    = gross * PAY_CONFIG.eiRate;
  const tax   = gross * PAY_CONFIG.taxRate;
  const net   = gross - cpp - ei - tax;

  return { periodStart: start, periodEnd: end, regularHours, otHours, holidayHours, holPremGross, sickPayoutGross, sickDaysUnused, gross, cpp, ei, tax, net, daysLogged, daysConfirmed, daysProjected, ptoDays };
}
