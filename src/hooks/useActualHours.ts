import { useState } from 'react';
import { isStatDay } from '../lib/stats';
import { calcOT, calcHours, netActualHours } from '../lib/ot';
import type { ShiftType, ShiftWithUser } from '../types';

/**
 * Actual-hours state for the shift sheet, pre-filled from the scheduled preset so
 * a normal day is zero re-typing. The scheduled block (roster truth) and the actual
 * block (pay truth) stay distinct columns — this owns only the actual side plus its
 * live net/OT preview. The parent (FlipShiftSheet) owns the single Save that writes
 * both, and calls syncToScheduled when a preset is tapped so "actual = what I was
 * scheduled" is the default a user only edits when reality differed.
 */
export interface ActualHours {
  actualStart: string;
  actualEnd: string;
  isStat: boolean;
  setActualStart: (v: string) => void;
  setActualEnd: (v: string) => void;
  setIsStat: (v: boolean) => void;
  /** Pre-fill actual to a scheduled preset's times (the "worked as scheduled" default). */
  syncToScheduled: (start: string, end: string) => void;
  /** A flip to a day NOT worked (sick / pto / day-off): drop the schedule-derived pre-fill so the
   *  default is "didn't work". No-op when the shift already has hours LOGGED — see below. */
  clearUnloggedPrefill: () => void;
  netHrs: number;
  previewOT: number;
  breakDeducted: boolean;
}

export function useActualHours(shift: ShiftWithUser, shiftType: ShiftType | null): ActualHours {
  // Pre-fill: a shift with hours already logged shows those; an unlogged one falls
  // back to its scheduled times, so tapping a preset and saving logs "as scheduled"
  // without the old collapsed-section re-typing.
  const [actualStart, setActualStart] = useState(shift.actualStartTime ?? shift.startTime ?? '');
  const [actualEnd,   setActualEnd]   = useState(shift.actualEndTime   ?? shift.endTime   ?? '');
  const [isStat,      setIsStat]      = useState(shift.isStat ?? isStatDay(shift.date));

  const syncToScheduled = (start: string, end: string) => {
    setActualStart(start);
    setActualEnd(end);
  };

  // ⚠️⚠️ THE PHANTOM-OT BUG (Aaron's own sick day, 2026-09-14). An unlogged MID pre-fills actual
  // 09:30–18:00 "as scheduled"; flipping it to SICK kept that pre-fill (sick has no preset times, so
  // nothing re-synced it) and Save logged it as WORKED. `calcOT` counts every actual hour on a
  // full-day type as OT — correct for the Sunday he was called in on — so a paid sick day read as
  // 0 regular + 8 OT instead of the 8 regular that PTO and sick both get in `calcPayEstimate`.
  //
  // ⚠️ AND IT MUST NEVER TOUCH LOGGED HOURS. That is the called-in-on-a-day-off case the actual-hours
  // section exists for (see FlipShiftSheet), and the reason the old unconditional blanking was
  // removed. Only a value that came from the SCHEDULE is cleared.
  const hasLogged = !!(shift.actualStartTime || shift.actualEndTime);
  const clearUnloggedPrefill = () => {
    if (hasLogged) return;
    setActualStart('');
    setActualEnd('');
  };

  const previewOT = calcOT({
    ...shift,
    shiftType: shiftType ?? shift.shiftType,
    actualStartTime: actualStart || undefined,
    actualEndTime:   actualEnd   || undefined,
    isStat,
  });
  const grossHrs      = calcHours(actualStart, actualEnd);
  const netHrs        = netActualHours(grossHrs);
  const breakDeducted = grossHrs > 0 && netHrs < grossHrs;

  return {
    actualStart, actualEnd, isStat,
    setActualStart, setActualEnd, setIsStat,
    syncToScheduled, clearUnloggedPrefill,
    netHrs, previewOT, breakDeducted,
  };
}
