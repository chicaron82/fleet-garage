import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { pushNotification } from '../lib/garage-uploads';
import { useAuth } from './AuthContext';
import { useUserResolver } from '../hooks/useUserResolver';
import { usePeakSeason } from '../hooks/usePeakSeason';
import { usePTOStats } from '../hooks/usePTOStats';
import { ownedTallyDelta, type TallyShift } from '../lib/ptoTally';
import { withSubmitLock } from '../lib/submitLock';
import { resolveShiftNames } from '../lib/resolveShiftNames';
import { useTodayShifts } from '../hooks/useTodayShifts';
// Pure helpers (toISO, getWeekBounds, formatShiftLabel, buildRowToShift,
// isManagerEditingOtherUser) live in lib/schedule-helpers — extracted at the
// 330-cap wall; import them from there, not from this context.
import { toISO, getWeekBounds, formatShiftLabel, isManagerEditingOtherUser, buildRowToShift } from '../lib/schedule-helpers';
import { PROTECTED_IMPORT_TYPES, dropProtectedDays, type ImportOutcome, type PreservedDay } from '../lib/scheduleImportBuild';
import { canManageSchedule } from '../types';
import type { Attendance, Shift, ShiftType, ShiftWithUser } from '../types';

// ── Context ───────────────────────────────────────────────────────────────────

interface ScheduleContextValue {
  // ⚠️ VIEW-WINDOWED: only the currently displayed week/month is loaded (see the
  // auto-load effect). Safe for the schedule view and today-scoped reads (today is
  // always in-window). Do NOT aggregate an arbitrary date range from this — it will
  // be silently partial. For period spans (e.g. a pay period), fetch your own range
  // with rowToShiftBase, as PayEstimateCard does.
  shifts: ShiftWithUser[];
  /** TODAY's shifts, decoupled from the navigable `shifts` window — My Day / quick-start reflect today. */
  todayShifts: ShiftWithUser[];
  loading: boolean;
  viewMode: 'week' | 'calendar';
  currentDate: Date;
  isPeakSeason: boolean;
  ptoEntitlement: number;
  ptoUsed: number;
  sickDaysUsed: number;
  setViewMode: (mode: 'week' | 'calendar') => void;
  setCurrentDate: (date: Date) => void;
  goToPrev: () => void;
  goToNext: () => void;
  goToToday: () => void;
  togglePeakSeason: () => Promise<void>;
  updatePtoEntitlement: (days: number) => Promise<void>;
  createShift: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>) => Promise<void>;
  bulkCreateShifts: (shifts: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>[]) => Promise<void>;
  /** Replaces the range for these staff, EXCEPT booked pto/sick. Returns what it wrote + kept. */
  importWeekShifts: (userIds: string[], startDate: string, endDate: string, shifts: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>[]) => Promise<ImportOutcome>;
  updateShift: (id: string, updates: Partial<Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>>) => Promise<void>;
  setPtoApproved: (id: string, approved: boolean) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  logActualHours: (id: string, actualStartTime: string, actualEndTime: string, isStat: boolean) => Promise<void>;
  setShiftAttendance: (id: string, attendance: Attendance | null) => Promise<void>;
  canEditShift: (shift: Shift) => boolean;
  refresh: () => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { getProfile } = useUserResolver();
  const rowToShift = useMemo(() => buildRowToShift(getProfile), [getProfile]);
  const rowToShiftRef = useRef(rowToShift);
  useEffect(() => { rowToShiftRef.current = rowToShift; });
  const [shifts, setShifts]           = useState<ShiftWithUser[]>([]);
  const [loading, setLoading]         = useState(false);
  const [viewMode, setViewMode]       = useState<'week' | 'calendar'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Derive display shifts by re-resolving each shift's user from its userId
  // against the CURRENT profiles map. loadShifts maps rows at fetch time, so on a
  // cold open the schedule can load before ProfilesContext populates — baking in
  // an 'Unknown' name that never re-resolved (My-Day "on with you" showed every
  // coworker as "Unknown", 2026-07-03). Deriving here re-resolves the moment
  // profiles arrive, with no refetch and no setState-in-effect.
  const resolvedShifts = useMemo(() => resolveShiftNames(shifts, getProfile), [shifts, getProfile]);
  // TODAY's shifts on their own — decoupled from the navigable `shifts` window (see useTodayShifts),
  // so My Day + the shift-aware quick-start reflect today even if the Schedule screen was left on
  // another week (bug 2026-07-10). `todayStr` recomputes each render → reloads across midnight.
  const { todayShifts, setTodayShifts } = useTodayShifts(toISO(new Date()), activeBranch, rowToShiftRef);
  const resolvedTodayShifts = useMemo(() => resolveShiftNames(todayShifts, getProfile), [todayShifts, getProfile]);

  // Reflect a re-mapped shift into BOTH windows — the navigable `shifts` and today's —
  // so an edit (attendance tapped from My Day, a schedule tweak) shows wherever it's displayed.
  const patchShift = (id: string, updated: ShiftWithUser) => {
    setShifts(prev => prev.map(s => s.id === id ? updated : s));
    setTodayShifts(prev => prev.map(s => s.id === id ? updated : s));
  };

  const { isPeakSeason, togglePeakSeason }                                          = usePeakSeason();
  const { ptoEntitlement, ptoUsed, sickDaysUsed, updatePtoEntitlement, adjustPTO, adjustSick, refreshTallies } = usePTOStats(user);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  // Keep the live PTO/sick tally in sync after any shift write. Every path —
  // create (null → after), delete (before → null), edit/flip (before → after) —
  // routes through here so none can silently drift out of sync again. The tally
  // is the logged-in user's *personal* counter (seeded by a query scoped to
  // user.id), so `ownerId` gates the delta: a manager editing a teammate's shift
  // must not move the manager's own tally.
  const applyTally = (ownerId: string, before: TallyShift | null, after: TallyShift | null) => {
    const { pto, sick } = ownedTallyDelta(ownerId, user?.id, before, after, new Date().getFullYear());
    if (pto)  adjustPTO(pto);
    if (sick) adjustSick(sick);
  };

  const loadShifts = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });
    if (!error && data) {
      const rows = (data as Record<string, unknown>[]).map(r => rowToShiftRef.current(r));
      setShifts(activeBranch === 'ALL' ? rows : rows.filter(s => s.branchId === activeBranch));
    }
    setLoading(false);
  }, [activeBranch]);

  const createShift = async (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>) => {
    // Keyed per user+date+type — two same-frame taps (e.g. logging a sick day) can
    // otherwise insert two shift rows and corrupt the limited tally (0/6).
    await withSubmitLock(`shift:${shift.userId}:${shift.date}:${shift.shiftType}`, async () => {
      const { data, error } = await writeWithRefresh(() =>
        supabase.from('shifts').insert({
          user_id: shift.userId,
          date: shift.date,
          start_time: shift.startTime,
          end_time: shift.endTime,
          shift_type: shift.shiftType,
          notes: shift.notes,
          actual_start_time: shift.actualStartTime,
          actual_end_time: shift.actualEndTime,
          is_stat: shift.isStat,
        }).select().single()
      );
      if (error) throw error;
      const created = rowToShift(data as Record<string, unknown>);
      setShifts(prev => prev.some(s => s.id === created.id) ? prev : [...prev, created]);
      // A shift created for today must also land in today's window (My Day).
      if (created.date === toISO(new Date())) setTodayShifts(prev => prev.some(s => s.id === created.id) ? prev : [...prev, created]);
      applyTally(shift.userId, null, { shiftType: shift.shiftType, date: shift.date });
      if (user && isManagerEditingOtherUser(user.role, user.id, shift.userId)) {
        const target = getProfile(shift.userId);
        if (target) {
          await pushNotification(
            user.branchId, [target.role], '📅',
            `${user.name} added ${formatShiftLabel(shift.shiftType, shift.date)} to your schedule.`,
            'info', { shiftDate: shift.date, shiftType: shift.shiftType }, target.id,
          );
        }
      }
    });
  };

  const bulkCreateShifts = async (newShifts: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>[]) => {
    // Keyed on the payload signature — a double-tapped fill would otherwise insert
    // the whole range twice.
    await withSubmitLock(`bulkShifts:${newShifts[0]?.userId}:${newShifts[0]?.date}:${newShifts.length}`, async () => {
      const rows = newShifts.map(s => ({
        user_id:    s.userId,
        date:       s.date,
        start_time: s.startTime ?? null,
        end_time:   s.endTime   ?? null,
        shift_type: s.shiftType,
        notes:      s.notes     ?? null,
      }));
      const { data, error } = await writeWithRefresh(() =>
        supabase.from('shifts').upsert(rows, { onConflict: 'user_id,date', ignoreDuplicates: true }).select()
      );
      if (error) throw error;
      const created = (data as Record<string, unknown>[]).map(rowToShift);
      setShifts(prev => {
        const existing = new Set(prev.map(s => s.id));
        return [...prev, ...created.filter(s => !existing.has(s.id))];
      });
      for (const s of newShifts) applyTally(s.userId, null, { shiftType: s.shiftType, date: s.date });
    });
  };

  // Import a whole week from a photo: wipe the window for the imported people (a QUIET
  // range-delete — no per-row notifications) then create the parsed shifts via the proven
  // Bulk path. Replace semantics: re-importing a week overwrites it — EXCEPT booked time off.
  //
  // BOOKED TIME OFF SURVIVES THE REPLACE. A printed sheet routinely omits approved PTO (the
  // boss forgetting to mark Aaron's is the recurring case, not an edge case), so treating the
  // sheet as authoritative silently destroyed real bookings — and with them the number he
  // plans his year from. When FG holds a pto/sick day and the sheet disagrees, FG's record is
  // the one more likely to be right: keep it, refuse to double-book that date, and report what
  // was kept so it's never silent. A genuinely cancelled booking is still one tap to change.
  //
  // Tallies are RE-READ from the DB afterwards rather than nudged: the ±1 deltas only cover
  // single-shift paths, so a bulk delete drifted the counter (it read 15/15 against a DB
  // holding 13). See [bug-schedule-pto-counter-stale] + [ticket-schedule-preserve-pto-on-import].
  const importWeekShifts = async (
    userIds: string[],
    startDate: string,
    endDate: string,
    newShifts: Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>[],
  ): Promise<ImportOutcome> => {
    let preserved: PreservedDay[] = [];
    if (userIds.length > 0) {
      // Read the protected rows BEFORE deleting, so we know what to skip on the way back in.
      const { data: keep, error: readErr } = await supabase
        .from('shifts')
        .select('user_id, date, shift_type')
        .in('user_id', userIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .in('shift_type', PROTECTED_IMPORT_TYPES);
      if (readErr) throw readErr;
      preserved = (keep ?? []).map((r) => {
        const row = r as { user_id: string; date: string; shift_type: string };
        return { userId: row.user_id, date: row.date, shiftType: row.shift_type as ShiftType };
      });

      const { error } = await writeWithRefresh(() =>
        supabase
          .from('shifts')
          .delete()
          .in('user_id', userIds)
          .gte('date', startDate)
          .lte('date', endDate)
          .not('shift_type', 'in', `(${PROTECTED_IMPORT_TYPES.join(',')})`),
      );
      if (error) throw error;
    }
    // Never write over a day we just protected — that would duplicate the date.
    const toWrite = dropProtectedDays(newShifts, preserved);
    if (toWrite.length > 0) await bulkCreateShifts(toWrite);
    await refreshTallies(); // bulk writes bypass the ±1 deltas — re-read the truth
    refresh();
    return { written: toWrite.length, preserved };
  };

  const updateShift = async (id: string, updates: Partial<Omit<Shift, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>>) => {
    const existing = shifts.find(s => s.id === id);
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('shifts')
        .update({
          date:       updates.date,
          start_time: updates.startTime ?? null,
          end_time:   updates.endTime   ?? null,
          shift_type: updates.shiftType,
          notes:      updates.notes     ?? null,
          pto_alternate_date: updates.ptoAlternateDate ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
    );
    if (error) throw error;
    patchShift(id, rowToShift(data as Record<string, unknown>));
    if (existing) {
      applyTally(
        existing.userId,
        { shiftType: existing.shiftType, date: existing.date },
        { shiftType: updates.shiftType ?? existing.shiftType, date: updates.date ?? existing.date },
      );
    }
    if (user && existing && isManagerEditingOtherUser(user.role, user.id, existing.userId)) {
      const target = getProfile(existing.userId);
      if (target) {
        const from = formatShiftLabel(existing.shiftType, existing.date);
        const newType = updates.shiftType ?? existing.shiftType;
        const newDate = updates.date ?? existing.date;
        const msg = newType === existing.shiftType && newDate === existing.date
          ? `${user.name} updated your ${from}.`
          : `${user.name} changed your ${from} to ${formatShiftLabel(newType, newDate)}.`;
        await pushNotification(
          user.branchId, [target.role], '📅', msg,
          'info', { shiftDate: newDate, shiftType: newType }, target.id,
        );
      }
    }
  };

  // Targeted update of just the approval flag — avoids updateShift, which would
  // null out start/end times when called with a partial payload.
  const setPtoApproved = async (id: string, approved: boolean) => {
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('shifts')
        // pto_approved was added in migration 067; stale database.types.ts doesn't know it yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ pto_approved: approved, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single()
    );
    if (error) throw error;
    patchShift(id, rowToShift(data as Record<string, unknown>));
  };

  const deleteShift = async (id: string) => {
    const deleted = shifts.find(s => s.id === id);
    const { error } = await writeWithRefresh(() => supabase.from('shifts').delete().eq('id', id));
    if (error) throw error;
    setShifts(prev => prev.filter(s => s.id !== id));
    setTodayShifts(prev => prev.filter(s => s.id !== id));
    if (deleted) applyTally(deleted.userId, { shiftType: deleted.shiftType, date: deleted.date }, null);
    if (user && deleted && isManagerEditingOtherUser(user.role, user.id, deleted.userId)) {
      const target = getProfile(deleted.userId);
      if (target) {
        await pushNotification(
          user.branchId, [target.role], '📅',
          `${user.name} removed your ${formatShiftLabel(deleted.shiftType, deleted.date)}.`,
          'info', { shiftDate: deleted.date }, target.id,
        );
      }
    }
  };

  // Update one shift's columns (stamps updated_at) and re-map the row locally.
  const updateShiftRow = async (id: string, patch: Record<string, unknown>) => {
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('shifts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    );
    if (error) throw error;
    patchShift(id, rowToShift(data as Record<string, unknown>));
  };

  const logActualHours = (id: string, actualStartTime: string, actualEndTime: string, isStat: boolean) =>
    updateShiftRow(id, { actual_start_time: actualStartTime || null, actual_end_time: actualEndTime || null, is_stat: isStat });

  // Layer attendance on top of the roster — tapped from the My-Day pills
  // (scheduled → present → absent → scheduled). null clears it back to scheduled.
  const setShiftAttendance = (id: string, attendance: Attendance | null) =>
    updateShiftRow(id, { attendance });

  // ── Permissions ────────────────────────────────────────────────────────────

  const canEditShift = (shift: Shift): boolean => {
    if (!user) return false;
    if (canManageSchedule(user.role)) return true; // leads + managers build the floor schedule
    return shift.userId === user.id;
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goToPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const goToNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const refresh = () => {
    if (viewMode === 'week') {
      const { start, end } = getWeekBounds(currentDate);
      loadShifts(toISO(start), toISO(end));
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      loadShifts(toISO(start), toISO(end));
    }
  };

  // ── Auto-load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (viewMode === 'week') {
      const { start, end } = getWeekBounds(currentDate);
      loadShifts(toISO(start), toISO(end));
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      loadShifts(toISO(start), toISO(end));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [currentDate, viewMode, loadShifts]);

  return (
    <ScheduleContext.Provider value={{
      shifts: resolvedShifts, todayShifts: resolvedTodayShifts, loading, viewMode, currentDate, isPeakSeason,
      ptoEntitlement, ptoUsed, sickDaysUsed,
      setViewMode, setCurrentDate,
      goToPrev, goToNext, goToToday, togglePeakSeason, updatePtoEntitlement,
      createShift, bulkCreateShifts, importWeekShifts, updateShift, setPtoApproved, deleteShift, logActualHours,
      setShiftAttendance, canEditShift, refresh,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchedule(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
