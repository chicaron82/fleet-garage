// Pins the pure schedule helpers extracted from ScheduleContext at the 330-cap
// wall (docs/ticket-near-cap-file-extractions.md). Extraction preserves
// behavior — these lock the behavior that was previously only reachable
// through the provider.
import { describe, it, expect } from 'vitest';
import {
  toISO,
  getWeekBounds,
  formatShiftLabel,
  isManagerEditingOtherUser,
  buildRowToShift,
} from '../../src/lib/schedule-helpers';
import type { Profile } from '../../src/types';

describe('toISO', () => {
  it('formats a local date as YYYY-MM-DD with zero-padding', () => {
    expect(toISO(new Date(2026, 6, 16))).toBe('2026-07-16');
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('keys on the LOCAL date — a late-evening time never rolls to the next UTC day', () => {
    // 23:30 local on Jul 16 is Jul 17 in UTC for any western timezone —
    // toISOString() would shift the day; toISO must not.
    expect(toISO(new Date(2026, 6, 16, 23, 30))).toBe('2026-07-16');
  });
});

describe('getWeekBounds', () => {
  it('a mid-week date snaps to its Monday-start week', () => {
    // Thu 2026-07-16 → week Mon 07-13 .. Sun 07-19
    const { start, end } = getWeekBounds(new Date(2026, 6, 16));
    expect(toISO(start)).toBe('2026-07-13');
    expect(toISO(end)).toBe('2026-07-19');
  });

  it('Monday is its own week start', () => {
    const { start, end } = getWeekBounds(new Date(2026, 6, 13));
    expect(toISO(start)).toBe('2026-07-13');
    expect(toISO(end)).toBe('2026-07-19');
  });

  it('Sunday belongs to the week it ENDS (dow=0 edge)', () => {
    // Sun 2026-07-19 → still Mon 07-13 .. Sun 07-19, not the next week
    const { start, end } = getWeekBounds(new Date(2026, 6, 19));
    expect(toISO(start)).toBe('2026-07-13');
    expect(toISO(end)).toBe('2026-07-19');
  });

  it('spans a month boundary without drifting', () => {
    // Sat 2026-08-01 → week Mon 07-27 .. Sun 08-02
    const { start, end } = getWeekBounds(new Date(2026, 7, 1));
    expect(toISO(start)).toBe('2026-07-27');
    expect(toISO(end)).toBe('2026-08-02');
  });
});

describe('formatShiftLabel', () => {
  it('labels the special types', () => {
    expect(formatShiftLabel('day-off', '2026-07-16')).toBe('Day Off on Thu, Jul 16');
    expect(formatShiftLabel('pto', '2026-07-16')).toBe('PTO on Thu, Jul 16');
    expect(formatShiftLabel('sick', '2026-07-16')).toBe('Sick Day on Thu, Jul 16');
  });

  it('capitalizes a working shift type', () => {
    expect(formatShiftLabel('opening', '2026-07-16')).toBe('Opening shift on Thu, Jul 16');
    expect(formatShiftLabel('closing', '2026-07-17')).toBe('Closing shift on Fri, Jul 17');
  });
});

describe('isManagerEditingOtherUser', () => {
  it('true only for a schedule-managing role acting on someone else', () => {
    // Note: VSA IS schedule-managing in FG (Aaron hand-loads the crew schedule
    // as a VSA — CAN_MANAGE_SCHEDULE includes it); Driver is the excluded role.
    expect(isManagerEditingOtherUser('Branch Manager', 'mgr-1', 'vsa-1')).toBe(true);
    expect(isManagerEditingOtherUser('VSA', 'vsa-1', 'vsa-2')).toBe(true);
    expect(isManagerEditingOtherUser('Branch Manager', 'mgr-1', 'mgr-1')).toBe(false);
    expect(isManagerEditingOtherUser('Driver', 'd-1', 'vsa-2')).toBe(false);
  });
});

describe('buildRowToShift', () => {
  const row = {
    id: 's-1', user_id: 'u-1', date: '2026-07-16',
    shift_type: 'opening', created_at: 'c', updated_at: 'u',
  };

  it('layers the resolved profile onto the base row', () => {
    const profile = { id: 'u-1', name: 'Aaron S.', role: 'Lead VSA', branchId: 'YWG-South' } as unknown as Profile;
    const shift = buildRowToShift(() => profile)(row);
    expect(shift.user).toEqual({ name: 'Aaron S.', role: 'Lead VSA' });
    expect(shift.branchId).toBe('YWG-South');
    expect(shift.id).toBe('s-1');
    expect(shift.shiftType).toBe('opening');
  });

  it('falls back to Unknown/VSA/YWG when the profile does not resolve', () => {
    const shift = buildRowToShift(() => null)(row);
    expect(shift.user).toEqual({ name: 'Unknown', role: 'VSA' });
    expect(shift.branchId).toBe('YWG');
  });
});
