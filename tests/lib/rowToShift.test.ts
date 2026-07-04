import { describe, it, expect } from 'vitest';
import { rowToShiftBase } from '../../src/lib/rowToShift';

// Canonical DB row → Shift column mapping. These lock the snake_case → camelCase
// translation, the null → undefined coalescing, the boolean defaults, and the
// 'YWG' branchId default that ScheduleContext later overrides from the profile.

const fullRow: Record<string, unknown> = {
  id: 's1',
  user_id: 'u1',
  date: '2026-06-02',
  start_time: '06:45',
  end_time: '15:15',
  shift_type: 'opening',
  notes: 'covering for Ana',
  actual_start_time: '07:00',
  actual_end_time: '15:30',
  is_stat: true,
  attendance: 'present',
  pto_approved: true,
  pto_alternate_date: '2026-06-05',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T12:00:00Z',
};

describe('rowToShiftBase', () => {
  it('maps every snake_case column to its camelCase Shift field', () => {
    expect(rowToShiftBase(fullRow)).toEqual({
      id: 's1',
      userId: 'u1',
      date: '2026-06-02',
      startTime: '06:45',
      endTime: '15:15',
      shiftType: 'opening',
      notes: 'covering for Ana',
      actualStartTime: '07:00',
      actualEndTime: '15:30',
      isStat: true,
      attendance: 'present',
      ptoApproved: true,
      ptoAlternateDate: '2026-06-05',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T12:00:00Z',
      branchId: 'YWG',
    });
  });

  it('coalesces null optional columns to undefined (not null)', () => {
    const sparse: Record<string, unknown> = {
      id: 's2',
      user_id: 'u2',
      date: '2026-06-03',
      start_time: null,
      end_time: null,
      shift_type: 'day-off',
      notes: null,
      actual_start_time: null,
      actual_end_time: null,
      is_stat: null,
      attendance: null,
      pto_approved: null,
      pto_alternate_date: null,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    };
    const shift = rowToShiftBase(sparse);
    expect(shift.startTime).toBeUndefined();
    expect(shift.endTime).toBeUndefined();
    expect(shift.notes).toBeUndefined();
    expect(shift.actualStartTime).toBeUndefined();
    expect(shift.actualEndTime).toBeUndefined();
    expect(shift.attendance).toBeUndefined();
    expect(shift.ptoAlternateDate).toBeUndefined();
  });

  it('defaults is_stat and pto_approved to false when null', () => {
    const shift = rowToShiftBase({ ...fullRow, is_stat: null, pto_approved: null });
    expect(shift.isStat).toBe(false);
    expect(shift.ptoApproved).toBe(false);
  });

  it('always seeds branchId as YWG (ScheduleContext overrides from the profile)', () => {
    expect(rowToShiftBase(fullRow).branchId).toBe('YWG');
  });
});
