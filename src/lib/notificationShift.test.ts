import { describe, it, expect } from 'vitest';
import { workingShiftDates, offShiftNotifications, isOversightRole } from './notificationShift';
import type { ShiftType } from '../types';

const shift = (userId: string, date: string, shiftType: ShiftType) => ({ userId, date, shiftType });

describe('workingShiftDates', () => {
  const shifts = [
    shift('u1', '2026-06-16', 'closing'),
    shift('u1', '2026-06-17', 'opening'),
    shift('u1', '2026-06-18', 'day-off'),
    shift('u1', '2026-06-19', 'pto'),
    shift('u2', '2026-06-17', 'mid'),
  ];
  it('includes worked days, excludes day-off / PTO / sick and other users', () => {
    expect(workingShiftDates(shifts, 'u1')).toEqual(new Set(['2026-06-16', '2026-06-17']));
  });
});

describe('isOversightRole', () => {
  it('flags management roles', () => {
    expect(isOversightRole('Branch Manager')).toBe(true);
    expect(isOversightRole('Operations Manager')).toBe(true);
    expect(isOversightRole('VSA')).toBe(false);
    expect(isOversightRole('Lead VSA')).toBe(false);
  });
});

describe('offShiftNotifications', () => {
  const working = new Set(['2026-06-16', '2026-06-17']);
  // Local (no-Z) mid-day timestamps → businessDateOf is timezone-stable.
  const onShift  = { id: 'on',  created_at: '2026-06-17T18:00:00' };  // worked that day
  const offDay   = { id: 'off', created_at: '2026-06-18T18:00:00' };  // day off

  it('flags a notification fired on a non-working day', () => {
    expect(offShiftNotifications([onShift, offDay], working, 'VSA', 'u1')).toEqual(new Set(['off']));
  });

  it('a 2am post-close alert attributes back to the working business day (on-shift)', () => {
    // 02:00 → before the 4am cutover → business date is the prior day (06-16, worked).
    const lateNight = { id: 'late', created_at: '2026-06-17T02:00:00' };
    expect(offShiftNotifications([lateNight], working, 'VSA', 'u1').has('late')).toBe(false);
  });

  it('a notification addressed directly to you is never dimmed, even on a day off', () => {
    const directOnDayOff = { id: 'dm', created_at: '2026-06-18T18:00:00', recipient_user_id: 'u1' };
    expect(offShiftNotifications([directOnDayOff], working, 'VSA', 'u1').has('dm')).toBe(false);
    // …but a direct ping to someone *else* on your day off still dims for you.
    expect(offShiftNotifications([{ ...directOnDayOff, recipient_user_id: 'other' }], working, 'VSA', 'u1').has('dm')).toBe(true);
  });

  it('oversight roles get an empty set (see everything)', () => {
    expect(offShiftNotifications([offDay], working, 'Branch Manager', 'u1')).toEqual(new Set());
  });

  it('fail-open: no roster loaded (empty set) → nothing off-shift', () => {
    expect(offShiftNotifications([offDay], new Set(), 'VSA', 'u1')).toEqual(new Set());
  });
});
