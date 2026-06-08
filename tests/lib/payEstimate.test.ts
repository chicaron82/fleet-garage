import { describe, it, expect } from 'vitest';
import { getPayPeriod, calcPayEstimate, PAY_CONFIG } from '../../src/lib/payEstimate';
import type { Shift } from '../types';

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

  it('worked stat: Holiday = hours worked (regularRate); HolPrem = flat 8h entitlement (no OT for hours > 8)', () => {
    // 09:00–17:30 = 8.5h gross, net = 8h after break deduction
    const shift = makeShift({ date: '2026-06-06', isStat: true, actualStartTime: '09:00', actualEndTime: '17:30' });
    const est = calcPayEstimate([shift], today);
    expect(est.holidayHours).toBe(8);
    expect(est.holPremGross).toBeCloseTo(8 * PAY_CONFIG.regularRate, 3);  // flat entitlement, not OT-scaled
    expect(est.otHours).toBe(0);
    expect(est.regularHours).toBe(0);
    expect(est.daysLogged).toBe(1);
    // gross = 8 × 17.75 (Holiday) + 8 × 17.75 (HolPrem) = 142 + 142 = 284
    expect(est.gross).toBeCloseTo(284, 1);
  });

  it('unworked stat: HolPrem = 8h at regularRate; Holiday = $0', () => {
    const shift = makeShift({ date: '2026-06-06', isStat: true });
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
