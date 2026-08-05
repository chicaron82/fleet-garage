import { describe, it, expect } from 'vitest';
import { getPayPeriod, getActivePayPeriod, getPayday, periodConfidence, calcPayEstimate, PAY_CONFIG } from '../../src/lib/payEstimate';
import type { Shift } from '../../src/types';

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 's1', userId: '331965', date: '2026-06-06',
    shiftType: 'closing', startTime: '13:30', endTime: '23:00',
    isStat: false, ptoApproved: false,
    branchId: 'YWG', createdAt: '', updatedAt: '',
    ...overrides,
  };
}

describe('getPayPeriod', () => {
  it('returns the anchor period when today is the period end', () => {
    const { start, end } = getPayPeriod('2026-05-07');
    expect(start).toBe('2026-04-24');
    expect(end).toBe('2026-05-07');
  });

  it('advances to the next period the day after an anchor end', () => {
    const { start, end } = getPayPeriod('2026-05-08');
    expect(start).toBe('2026-05-08');
    expect(end).toBe('2026-05-21');
  });

  it('returns the correct period for a mid-period date', () => {
    // Jun 6 falls in the period Jun 5–Jun 18
    const { start, end } = getPayPeriod('2026-06-06');
    expect(start).toBe('2026-06-05');
    expect(end).toBe('2026-06-18');
  });

  it('returns the last-day period when today is a period end', () => {
    const { start, end } = getPayPeriod('2026-06-18');
    expect(start).toBe('2026-06-05');
    expect(end).toBe('2026-06-18');
  });
});

describe('getPayday', () => {
  it('adds the configured lag to the period end', () => {
    expect(getPayday({ end: '2026-06-04' })).toBe('2026-06-11'); // 7-day lag
    expect(PAY_CONFIG.payDayLagDays).toBe(7);
  });
});

describe('getActivePayPeriod — anchors on the next-cheque period', () => {
  it('in the lag window (period ended, payday not yet), the just-ended period is current', () => {
    // Jun 10: period Jun 5–18 contains today, but May 22–Jun 4 (pays Jun 11) is the next cheque.
    expect(getActivePayPeriod('2026-06-10')).toEqual({ start: '2026-05-22', end: '2026-06-04' });
  });

  it('stays current on payday itself (inclusive)', () => {
    expect(getActivePayPeriod('2026-06-11')).toEqual({ start: '2026-05-22', end: '2026-06-04' });
  });

  it('rolls forward to the in-progress period the day after payday', () => {
    expect(getActivePayPeriod('2026-06-12')).toEqual({ start: '2026-06-05', end: '2026-06-18' });
  });

  it('mid-period and well past the prior payday, the containing period is current', () => {
    expect(getActivePayPeriod('2026-06-15')).toEqual({ start: '2026-06-05', end: '2026-06-18' });
  });

  it("on a period's last day (before any lag), that period is current", () => {
    expect(getActivePayPeriod('2026-06-04')).toEqual({ start: '2026-05-22', end: '2026-06-04' });
  });
});

describe('periodConfidence — derived from today vs the period + its payday', () => {
  const P = (periodStart: string, periodEnd: string) => ({ periodStart, periodEnd });

  it('during the lag window (today Jun 10)', () => {
    expect(periodConfidence(P('2026-05-08', '2026-05-21'), '2026-06-10')).toBe('paid');          // paid cheques ago
    expect(periodConfidence(P('2026-05-22', '2026-06-04'), '2026-06-10')).toBe('near-final');    // the imminent cheque
    expect(periodConfidence(P('2026-06-05', '2026-06-18'), '2026-06-10')).toBe('in-progress');   // contains today
    expect(periodConfidence(P('2026-06-19', '2026-07-02'), '2026-06-10')).toBe('schedule-floor');// fully future
  });

  it('is near-final on payday itself (inclusive), and paid the day after', () => {
    expect(periodConfidence(P('2026-05-22', '2026-06-04'), '2026-06-11')).toBe('near-final');
    expect(periodConfidence(P('2026-05-22', '2026-06-04'), '2026-06-12')).toBe('paid');
  });
});

describe('calcPayEstimate', () => {
  const today = '2026-06-06';

  it('returns zeros when no shifts are in the period', () => {
    const est = calcPayEstimate([], today);
    expect(est.regularHours).toBe(0);
    expect(est.otHours).toBe(0);
    expect(est.holidayHours).toBe(0);
    expect(est.holPremGross).toBe(0);
    expect(est.sickPayoutGross).toBe(0);
    expect(est.sickDaysUnused).toBe(0);
    expect(est.gross).toBe(0);
    expect(est.net).toBe(0);
    expect(est.daysLogged).toBe(0);
    expect(est.daysProjected).toBe(0);
    expect(est.ptoDays).toBe(0);
  });

  it('projects scheduled hours for unlogged working days', () => {
    // 13:30–23:00 = 9.5h gross, net = 9h, capped at 8h regular
    const shift = makeShift({ date: '2026-06-06' });
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(8);
    expect(est.otHours).toBe(0); // no OT projected for unlogged
    expect(est.daysProjected).toBe(1);
    expect(est.daysLogged).toBe(0);
  });

  it('splits unlogged scheduled days: past → confirmed, today/future → projected', () => {
    // now = 2026-06-06; 06-05 already happened, 06-06 (today) + 06-10 are not yet confirmed.
    const shifts = [makeShift({ date: '2026-06-05' }), makeShift({ date: '2026-06-06' }), makeShift({ date: '2026-06-10' })];
    const est = calcPayEstimate(shifts, today, 0, today);
    expect(est.daysConfirmed).toBe(1);
    expect(est.daysProjected).toBe(2);
    expect(est.daysLogged).toBe(0);
  });

  it('uses actual hours when logged — regular shift', () => {
    // 10:30–20:00 = 9.5h gross, net = 9h, 8h regular + 1h OT
    const shift = makeShift({ date: '2026-06-06', actualStartTime: '10:30', actualEndTime: '20:00' });
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(8);
    expect(est.otHours).toBe(1);
    expect(est.daysLogged).toBe(1);
    expect(est.daysProjected).toBe(0);
  });

  it('counts all net hours as OT for a day-off with logged hours', () => {
    // 09:00–13:00 = 4h gross, < 5h so no break, 4h OT, 0h regular
    const shift = makeShift({ date: '2026-06-06', shiftType: 'day-off', actualStartTime: '09:00', actualEndTime: '13:00' });
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(0);
    expect(est.otHours).toBe(4);
    expect(est.daysLogged).toBe(1);
  });

  it('ignores day-off shifts with no actual hours', () => {
    const shift = makeShift({ date: '2026-06-06', shiftType: 'day-off' });
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(0);
    expect(est.otHours).toBe(0);
    expect(est.daysProjected).toBe(0);
  });

  it('excludes shifts outside the current pay period', () => {
    const shift = makeShift({ date: '2026-05-01' }); // prior period
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(0);
  });

  it('computes gross correctly from regular and OT hours', () => {
    const shift = makeShift({ date: '2026-06-06', actualStartTime: '10:30', actualEndTime: '20:00' });
    const est = calcPayEstimate([shift], today);
    // 8h × 17.75 + 1h × 26.625 = 142 + 26.625 = 168.625
    expect(est.gross).toBeCloseTo(168.625, 3);
  });

  it('deductions sum to gross minus net', () => {
    const shift = makeShift({ date: '2026-06-06', actualStartTime: '10:30', actualEndTime: '20:00' });
    const est = calcPayEstimate([shift], today);
    expect(est.cpp + est.ei + est.tax).toBeCloseTo(est.gross - est.net, 5);
  });

  it('does not deduct CPP below the biweekly exemption', () => {
    // Very short shift — gross below exemption
    const shift = makeShift({ date: '2026-06-06', actualStartTime: '09:00', actualEndTime: '13:00', shiftType: 'day-off' });
    const est = calcPayEstimate([shift], today);
    // 4h OT × 26.625 = 106.50 gross — still above exemption (134.62)? No, 106.50 < 134.62
    // cpp should be 0
    expect(est.cpp).toBe(0);
  });

  it('uses PAY_CONFIG rates', () => {
    expect(PAY_CONFIG.regularRate).toBe(17.75);
    expect(PAY_CONFIG.otRate).toBe(26.625);
    expect(PAY_CONFIG.employeeId).toBe('331965');
  });

  it('credits 8 regular hours for a PTO shift (always a full day)', () => {
    const shift = makeShift({ date: '2026-06-06', shiftType: 'pto' });
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(8);
    expect(est.otHours).toBe(0);
    expect(est.holidayHours).toBe(0);
    expect(est.holPremGross).toBe(0);
    expect(est.ptoDays).toBe(1);
    expect(est.daysProjected).toBe(1);
    expect(est.daysLogged).toBe(0);
  });

  it('credits 8 regular hours for a sick shift (always a full day)', () => {
    const shift = makeShift({ date: '2026-06-06', shiftType: 'sick' });
    const est = calcPayEstimate([shift], today);
    expect(est.regularHours).toBe(8);
    expect(est.otHours).toBe(0);
    expect(est.holidayHours).toBe(0);
    expect(est.holPremGross).toBe(0);
    expect(est.ptoDays).toBe(0);
    expect(est.daysProjected).toBe(1);
    expect(est.daysLogged).toBe(0);
  });

  it('worked stat (actuals): Holiday = hours worked (regularRate) + HolPrem = those hours at OT rate (1.5×)', () => {
    // 09:00–17:30 = 8.5h gross, net = 8h after break deduction
    const shift = makeShift({ date: '2026-06-06', isStat: true, actualStartTime: '09:00', actualEndTime: '17:30' });
    const est = calcPayEstimate([shift], today);
    expect(est.holidayHours).toBe(8);
    expect(est.holPremGross).toBeCloseTo(8 * PAY_CONFIG.otRate, 3);  // worked-holiday premium at 1.5×, not flat regular
    expect(est.otHours).toBe(0);
    expect(est.regularHours).toBe(0);
    expect(est.daysLogged).toBe(1);
    // gross = 8 × 17.75 (Holiday) + 8 × 26.625 (HolPrem) = 142 + 213 = 355
    expect(est.gross).toBeCloseTo(8 * PAY_CONFIG.regularRate + 8 * PAY_CONFIG.otRate, 1);
  });

  it('scheduled WORKED stat (no actuals): counts the worked hours + OT premium — NOT dropped to premium-only', () => {
    // The 2026-08-04 bug: a rostered working shift on a stat, no actuals yet, was treated as a day
    // OFF — dropping ~8h of pay so a stat period read LOWER than a normal week. Must mirror the
    // worked-stat treatment. mid 10:30–19:00 = 8.5h gross, net 8h.
    const shift = makeShift({ date: '2026-06-06', isStat: true, shiftType: 'mid', startTime: '10:30', endTime: '19:00' });
    const est = calcPayEstimate([shift], today);
    expect(est.holidayHours).toBe(8);                               // worked hours COUNTED, not dropped
    expect(est.holPremGross).toBeCloseTo(8 * PAY_CONFIG.otRate, 3); // premium at 1.5×
    expect(est.regularHours).toBe(0);
    expect(est.otHours).toBe(0);
    expect(est.gross).toBeCloseTo(8 * PAY_CONFIG.regularRate + 8 * PAY_CONFIG.otRate, 1);
  });

  it('unworked stat (day-off): HolPrem = flat 8h at regularRate; Holiday = $0', () => {
    // A stat you have OFF (day-off shift type) → holiday-pay entitlement only, no worked hours.
    const shift = makeShift({ date: '2026-06-06', isStat: true, shiftType: 'day-off' });
    const est = calcPayEstimate([shift], today);
    expect(est.holPremGross).toBeCloseTo(8 * PAY_CONFIG.regularRate, 5);
    expect(est.holidayHours).toBe(0);
    expect(est.otHours).toBe(0);
    expect(est.regularHours).toBe(0);
    expect(est.daysLogged).toBe(0);
    expect(est.gross).toBeCloseTo(8 * PAY_CONFIG.regularRate, 5);
  });

  it('sick payout: unused days paid out in the period containing Dec 1', () => {
    // Nov 20–Dec 3 period contains Dec 1; 2 sick days used → 4 days unused
    const est = calcPayEstimate([], '2026-12-01', 2);
    expect(est.sickDaysUnused).toBe(4);
    expect(est.sickPayoutGross).toBeCloseTo(4 * 8 * PAY_CONFIG.regularRate, 5);
    expect(est.gross).toBeCloseTo(4 * 8 * PAY_CONFIG.regularRate, 5);
  });

  it('sick payout: zero outside the December payout period', () => {
    const est = calcPayEstimate([], '2026-06-06', 0);
    expect(est.sickPayoutGross).toBe(0);
    expect(est.sickDaysUnused).toBe(0);
  });

  it('sick payout: full entitlement when no sick days used', () => {
    const est = calcPayEstimate([], '2026-12-01', 0);
    expect(est.sickDaysUnused).toBe(PAY_CONFIG.sickDaysEntitlement);
    expect(est.sickPayoutGross).toBeCloseTo(PAY_CONFIG.sickDaysEntitlement * 8 * PAY_CONFIG.regularRate, 5);
  });
});
