import { describe, it, expect } from 'vitest';
import {
  isOversightRole,
  offShiftNotifications,
  SHIFT_GRACE_MIN,
} from '../../src/lib/notificationShift';
import type { ShiftType, UserRole } from '../../src/types';

// Notifications and shift windows are both parsed as local time (no Z), so the
// comparison is timezone-agnostic — keep the fixtures local-naive to match.
type Notif = { id: string; created_at: string; recipient_user_id?: string | null };
const notif = (id: string, created_at: string, recipient?: string): Notif =>
  ({ id, created_at, recipient_user_id: recipient ?? null });

const shift = (date: string, shiftType: ShiftType, userId = 'me') =>
  ({ userId, date, shiftType });

const DAY = '2026-06-15';
// opening: 06:45–15:15, ±30min grace → window 06:15–15:45
const opening = [shift(DAY, 'opening')];

describe('isOversightRole', () => {
  it('is true for management oversight roles', () => {
    for (const r of ['Branch Manager', 'Operations Manager', 'City Manager'] as UserRole[]) {
      expect(isOversightRole(r)).toBe(true);
    }
  });

  it('is false for frontline roles', () => {
    for (const r of ['VSA', 'Lead VSA'] as UserRole[]) {
      expect(isOversightRole(r)).toBe(false);
    }
  });
});

describe('offShiftNotifications', () => {
  it('dims nothing for an oversight role — they see everything', () => {
    const notifs = [notif('n1', `${DAY}T03:00:00`)];
    const off = offShiftNotifications(notifs, opening, 'me', 'Branch Manager', false);
    expect(off.size).toBe(0);
  });

  it('fails open when the user has no worked shift loaded', () => {
    const notifs = [notif('n1', `${DAY}T03:00:00`)];
    expect(offShiftNotifications(notifs, [], 'me', 'VSA', false).size).toBe(0);
  });

  it('fails open when only full-day shifts (no window) are rostered', () => {
    const notifs = [notif('n1', `${DAY}T03:00:00`)];
    const off = offShiftNotifications(notifs, [shift(DAY, 'day-off')], 'me', 'VSA', false);
    expect(off.size).toBe(0);
  });

  it('keeps a notification inside the shift window', () => {
    const notifs = [notif('n1', `${DAY}T10:00:00`)];
    expect(offShiftNotifications(notifs, opening, 'me', 'VSA', false).size).toBe(0);
  });

  it('dims a notification before the window (even within commute, past grace)', () => {
    const notifs = [notif('n1', `${DAY}T05:00:00`)];
    const off = offShiftNotifications(notifs, opening, 'me', 'VSA', false);
    expect(off.has('n1')).toBe(true);
  });

  it('dims a 2am alert after a closing shift ends', () => {
    // closing non-peak: 13:30–22:00, window 13:00–22:30 → 2am next day is off
    const notifs = [notif('n1', '2026-06-16T02:00:00')];
    const off = offShiftNotifications(notifs, [shift(DAY, 'closing')], 'me', 'VSA', false);
    expect(off.has('n1')).toBe(true);
  });

  it('counts an alert inside the grace pad as on-shift', () => {
    // 06:20 is before 06:45 start but inside the 06:15 grace edge
    const notifs = [notif('n1', `${DAY}T06:20:00`)];
    expect(offShiftNotifications(notifs, opening, 'me', 'VSA', false).size).toBe(0);
  });

  it('never dims a notification addressed directly to the user', () => {
    const notifs = [notif('n1', `${DAY}T03:00:00`, 'me')];
    expect(offShiftNotifications(notifs, opening, 'me', 'VSA', false).size).toBe(0);
  });

  it('unions the windows of a split day (two shifts)', () => {
    const split = [shift(DAY, 'opening'), shift(DAY, 'closing')];
    // 18:00 is outside opening but inside closing (13:00–22:30)
    const notifs = [notif('n1', `${DAY}T18:00:00`)];
    expect(offShiftNotifications(notifs, split, 'me', 'VSA', false).size).toBe(0);
  });

  it('peak season shifts the closing window later', () => {
    // peak closing: 14:30–23:00, window 14:00–23:30. 23:15 is on-shift in peak, off otherwise.
    const notifs = [notif('n1', `${DAY}T23:15:00`)];
    const closing = [shift(DAY, 'closing')];
    expect(offShiftNotifications(notifs, closing, 'me', 'VSA', true).size).toBe(0);
    expect(offShiftNotifications(notifs, closing, 'me', 'VSA', false).has('n1')).toBe(true);
  });

  it('mid shift uses the 10:30–19:00 window', () => {
    const mid = [shift(DAY, 'mid', 'u4')];
    const inside = [notif('in', `${DAY}T12:00:00`)];
    const outside = [notif('out', `${DAY}T20:00:00`)]; // 8pm, past 19:00+30min grace
    expect(offShiftNotifications(inside, mid, 'u4', 'VSA', false).size).toBe(0);
    expect(offShiftNotifications(outside, mid, 'u4', 'VSA', false).has('out')).toBe(true);
  });

  it('exposes a 30-minute default grace', () => {
    expect(SHIFT_GRACE_MIN).toBe(30);
  });
});
