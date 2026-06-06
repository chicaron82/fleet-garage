import type { Shift, ShiftType } from '../types';

// Canonical DB row → Shift column mapping. Single source of truth for the
// shifts table's column shape. ScheduleContext layers user-resolution
// (branchId from profile + the `user` field) on top via spread; consumers
// that don't need identity (e.g. PayEstimateCard's own pay-period fetch)
// use this directly. branchId defaults to 'YWG' — ScheduleContext overrides
// it from the resolved profile.
export function rowToShiftBase(row: Record<string, unknown>): Shift {
  return {
    id:              row.id as string,
    userId:          row.user_id as string,
    date:            row.date as string,
    startTime:       (row.start_time        as string | null) ?? undefined,
    endTime:         (row.end_time          as string | null) ?? undefined,
    shiftType:       row.shift_type as ShiftType,
    notes:           (row.notes             as string | null) ?? undefined,
    actualStartTime: (row.actual_start_time as string | null) ?? undefined,
    actualEndTime:   (row.actual_end_time   as string | null) ?? undefined,
    isStat:          (row.is_stat as boolean | null) ?? false,
    ptoApproved:     (row.pto_approved as boolean | null) ?? false,
    ptoAlternateDate:(row.pto_alternate_date as string | null) ?? undefined,
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
    branchId:        'YWG',
  };
}
