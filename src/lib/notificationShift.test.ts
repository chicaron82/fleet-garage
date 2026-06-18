import { describe, it, expect } from 'vitest';
import { offShiftNotifications, isOversightRole, SHIFT_GRACE_MIN } from './notificationShift';
import type { ShiftType } from '../types';

const shift = (userId: string, date: string, shiftType: ShiftType) => ({ userId, date, shiftType });

// u1 works a closing on 06-16 (13:30–22:00) and an opening on 06-17 (06:45–15:15).
const roster = [
  shift('u1', '2026-06-16', 'closing'),
  shift('u1', '2026-06-17', 'opening'),
  shift('u1', '2026-06-18', 'day-off'),
  shift('u2', '2026-06-17', 'mid'),
];
const off = (notifs: { id: string; created_at: string; recipient_user_id?: string | null }[], peak = false) =>
  offShiftNotifications(notifs, roster, 'u1', 'VSA', peak);

// Local (no-Z) timestamps keep the window comparison timezone-stable in CI.
const n = (id: string, created_at: string, recipient_user_id?: string) => ({ id, created_at, recipient_user_id });

describe('isOversightRole', () => {
  it('flags management roles, not VSAs', () => {
    expect(isOversightRole('Branch Manager')).toBe(true);
    expect(isOversightRole('Operations Manager')).toBe(true);
    expect(isOversightRole('VSA')).toBe(false);
    expect(isOversightRole('Lead VSA')).toBe(false);
  });
});

describe('offShiftNotifications — time-of-day windows', () => {
  it('an alert DURING the shift window stays urgent', () => {
    expect(off([n('mid', '2026-06-16T18:00:00')]).has('mid')).toBe(false); // 6pm, in closing
    expect(off([n('am',  '2026-06-17T09:00:00')]).has('am')).toBe(false);  // 9am, in opening
  });

  it('an alert on a day OFF is dimmed', () => {
    expect(off([n('dayoff', '2026-06-18T12:00:00')])).toEqual(new Set(['dayoff']));
  });

  it('HEADLINE: a 2am post-close alert is now OFF-HOURS (dimmed), not counted', () => {
    // 02:00 on 06-17 — after the 06-16 close (+grace) and before the 06-17 open
    // (−grace). v1's businessDateOf counted it onto 06-16; the window model dims it.
    expect(off([n('late', '2026-06-17T02:00:00')])).toEqual(new Set(['late']));
  });

  it('respects the ±30m grace on both ends', () => {
    // close 22:00 → +30m = 22:30
    expect(off([n('justin',  '2026-06-16T22:25:00')]).has('justin')).toBe(false);
    expect(off([n('justout', '2026-06-16T22:45:00')]).has('justout')).toBe(true);
    // open 06:45 → −30m = 06:15
    expect(off([n('preok',  '2026-06-17T06:30:00')]).has('preok')).toBe(false);
    expect(off([n('preno',  '2026-06-17T06:00:00')]).has('preno')).toBe(true);
  });

  it('peak season widens the closing window to 23:00', () => {
    // 22:45 is off in normal season but inside peak closing (14:30–23:00, +30 → 23:30)
    expect(off([n('p', '2026-06-16T22:45:00')], false).has('p')).toBe(true);
    expect(off([n('p', '2026-06-16T22:45:00')], true).has('p')).toBe(false);
  });

  it('a direct ping (recipient_user_id) is never dimmed, even off-hours', () => {
    expect(off([n('dm', '2026-06-17T02:00:00', 'u1')]).has('dm')).toBe(false);
    // …but a direct ping to someone else off-hours still dims for you.
    expect(off([n('dm', '2026-06-17T02:00:00', 'other')]).has('dm')).toBe(true);
  });

  it('oversight roles get an empty set (see everything)', () => {
    expect(offShiftNotifications([n('x', '2026-06-18T12:00:00')], roster, 'u1', 'Branch Manager', false))
      .toEqual(new Set());
  });

  it('fail-open: a user with no worked shift in the roster dims nothing', () => {
    const allOff = [shift('u1', '2026-06-16', 'day-off'), shift('u1', '2026-06-17', 'pto')];
    expect(offShiftNotifications([n('x', '2026-06-20T12:00:00')], allOff, 'u1', 'VSA', false))
      .toEqual(new Set());
  });

  it('a split day unions both shift windows', () => {
    // u3 works opening AND closing on 06-16 → 06:45–15:15 ∪ 13:30–22:00 covers ~06:15–22:30
    const split = [shift('u3', '2026-06-16', 'opening'), shift('u3', '2026-06-16', 'closing')];
    const call = (id: string, ts: string) => offShiftNotifications([n(id, ts)], split, 'u3', 'VSA', false);
    expect(call('morning', '2026-06-16T08:00:00').has('morning')).toBe(false);  // in opening
    expect(call('evening', '2026-06-16T21:00:00').has('evening')).toBe(false);  // in closing
    expect(call('night',   '2026-06-17T01:00:00').has('night')).toBe(true);     // past both
  });

  it('a mid shift uses the 10:30–19:00 window', () => {
    const mid = [shift('u4', '2026-06-16', 'mid')];
    const call = (id: string, ts: string) => offShiftNotifications([n(id, ts)], mid, 'u4', 'VSA', false);
    expect(call('in',  '2026-06-16T12:00:00').has('in')).toBe(false);
    expect(call('out', '2026-06-16T20:00:00').has('out')).toBe(true); // 8pm, past 19:00+30
  });

  it('exposes the default grace as 30 minutes', () => {
    expect(SHIFT_GRACE_MIN).toBe(30);
  });
});
