import type { Shift } from '../types';
import { isFullDayShift } from '../types';
import { calcHours, calcOT, netActualHours } from './ot';

// ── Config ─────────────────────────────────────────────────────────────────────
// Rates and deduction parameters sourced from paystub (PP ending 2026-05-07).
// Tax rate is the observed effective rate for this income level (~$1,420 gross).
// CPP and EI are 2026 statutory rates.

export const PAY_CONFIG = {
  employeeId:            '331965',
  regularRate:            17.75,
  otRate:                 26.625,   // exactly 1.5×
  cppRate:                0.0595,
  cppBiweeklyExemption:   134.62,   // $3,500 / 26 periods
  eiRate:                 0.0163,
  taxRate:                0.117,    // observed effective rate
  anchorPeriodEnd:        '2026-05-07',
} as const;

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

// ── Estimate ───────────────────────────────────────────────────────────────────

export interface PayEstimate {
  periodStart:    string;
  periodEnd:      string;
  regularHours:   number;
  otHours:        number;
  gross:          number;
  cpp:            number;
  ei:             number;
  tax:            number;
  net:            number;
  daysLogged:     number;
  daysProjected:  number;
}

// myShifts should already be filtered to the current user.
export function calcPayEstimate(myShifts: Shift[], today: string): PayEstimate {
  const { start, end } = getPayPeriod(today);

  const periodShifts = myShifts.filter(s => s.date >= start && s.date <= end);

  let regularHours  = 0;
  let otHours       = 0;
  let daysLogged    = 0;
  let daysProjected = 0;

  for (const shift of periodShifts) {
    const hasActual = !!(shift.actualStartTime && shift.actualEndTime);

    if (hasActual) {
      daysLogged++;
      const ot  = calcOT(shift);
      const gross = calcHours(shift.actualStartTime, shift.actualEndTime);
      const net   = netActualHours(gross);
      otHours      += ot;
      regularHours += Math.max(0, net - ot);
    } else if (!isFullDayShift(shift.shiftType)) {
      // Not yet logged — project from scheduled hours (no OT assumed)
      daysProjected++;
      const scheduled = calcHours(shift.startTime, shift.endTime);
      const net       = netActualHours(scheduled);
      regularHours   += Math.min(net, 8);
    }
    // Full-day shifts with no actual hours (day-off, PTO, sick): $0 contribution
  }

  const gross = regularHours * PAY_CONFIG.regularRate + otHours * PAY_CONFIG.otRate;
  const cpp   = Math.max(0, gross - PAY_CONFIG.cppBiweeklyExemption) * PAY_CONFIG.cppRate;
  const ei    = gross * PAY_CONFIG.eiRate;
  const tax   = gross * PAY_CONFIG.taxRate;
  const net   = gross - cpp - ei - tax;

  return { periodStart: start, periodEnd: end, regularHours, otHours, gross, cpp, ei, tax, net, daysLogged, daysProjected };
}
