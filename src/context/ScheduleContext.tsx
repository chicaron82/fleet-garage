import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { USERS } from '../data/mock';
import type { Shift, ShiftWithUser, ShiftType, UserRole } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  const toMon = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + toMon);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

function rowToShift(row: Record<string, unknown>): ShiftWithUser {
  const userId = row.user_id as string;
  const u = USERS.find(u => u.id === userId);
  return {
    id:              row.id as string,
    userId,
    date:            row.date as string,
    startTime:       (row.start_time        as string | null) ?? undefined,
    endTime:         (row.end_time          as string | null) ?? undefined,
    shiftType:       row.shift_type as ShiftType,
    notes:           (row.notes             as string | null) ?? undefined,
    actualStartTime: (row.actual_start_time as string | null) ?? undefined,
    actualEndTime:   (row.actual_end_time   as string | null) ?? undefined,
    isStat:          (row.is_stat as boolean | null) ?? false,
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
    user: { name: u?.name ?? 'Unknown', role: (u?.role ?? 'VSA') as UserRole },
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ScheduleContextValue {
  shifts: ShiftWithUser[];
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
  createShift: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  bulkCreateShifts: (shifts: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  updateShift: (id: string, updates: Partial<Omit<Shift, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  logActualHours: (id: string, actualStartTime: string, actualEndTime: string, isStat: boolean) => Promise<void>;
  canEditShift: (shift: Shift) => boolean;
  refresh: () => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shifts, setShifts]           = useState<ShiftWithUser[]>([]);
  const [loading, setLoading]         = useState(false);
  const [viewMode, setViewMode]       = useState<'week' | 'calendar'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPeakSeason, setIsPeakSeason] = useState(false);
  const [ptoEntitlement, setPtoEntitlement] = useState(15);
  const [ptoUsed,        setPtoUsed]        = useState(0);
  const [sickDaysUsed,   setSickDaysUsed]   = useState(0);

  // ── Peak season ────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('branch_settings')
      .select('peak_season')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setIsPeakSeason(data.peak_season as boolean);
      });
  }, []);

  const togglePeakSeason = async () => {
    const next = !isPeakSeason;
    const { error } = await supabase
      .from('branch_settings')
      .update({ peak_season: next, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
    setIsPeakSeason(next);
  };

  // ── PTO / sick stats ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const year = new Date().getFullYear();
    supabase
      .from('user_pto')
      .select('pto_entitlement')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { if (data) setPtoEntitlement(data.pto_entitlement as number); });

    supabase
      .from('shifts')
      .select('shift_type')
      .eq('user_id', user.id)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .in('shift_type', ['pto', 'sick'])
      .then(({ data }) => {
        if (data) {
          const rows = data as { shift_type: string }[];
          setPtoUsed(rows.filter(r => r.shift_type === 'pto').length);
          setSickDaysUsed(rows.filter(r => r.shift_type === 'sick').length);
        }
      });
  }, [user]);

  const updatePtoEntitlement = async (days: number) => {
    if (!user) return;
    await supabase
      .from('user_pto')
      .upsert({ user_id: user.id, pto_entitlement: days, updated_at: new Date().toISOString() });
    setPtoEntitlement(days);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const loadShifts = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });
    if (!error && data) setShifts((data as Record<string, unknown>[]).map(rowToShift));
    setLoading(false);
  }, []);

  const createShift = async (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id:    shift.userId,
        date:       shift.date,
        start_time: shift.startTime ?? null,
        end_time:   shift.endTime   ?? null,
        shift_type: shift.shiftType,
        notes:      shift.notes     ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    setShifts(prev => [...prev, rowToShift(data as Record<string, unknown>)]);
    const thisYear = new Date().getFullYear();
    if (shift.date.startsWith(String(thisYear))) {
      if (shift.shiftType === 'pto')  setPtoUsed(prev => prev + 1);
      if (shift.shiftType === 'sick') setSickDaysUsed(prev => prev + 1);
    }
  };

  const bulkCreateShifts = async (newShifts: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const rows = newShifts.map(s => ({
      user_id:    s.userId,
      date:       s.date,
      start_time: s.startTime ?? null,
      end_time:   s.endTime   ?? null,
      shift_type: s.shiftType,
      notes:      s.notes     ?? null,
    }));
    const { data, error } = await supabase.from('shifts').insert(rows).select();
    if (error) throw error;
    setShifts(prev => [...prev, ...(data as Record<string, unknown>[]).map(rowToShift)]);
  };

  const updateShift = async (id: string, updates: Partial<Omit<Shift, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        date:       updates.date,
        start_time: updates.startTime ?? null,
        end_time:   updates.endTime   ?? null,
        shift_type: updates.shiftType,
        notes:      updates.notes     ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    setShifts(prev => prev.map(s => s.id === id ? rowToShift(data as Record<string, unknown>) : s));
  };

  const deleteShift = async (id: string) => {
    const deleted = shifts.find(s => s.id === id);
    const { error } = await supabase.from('shifts').delete().eq('id', id);
    if (error) throw error;
    setShifts(prev => prev.filter(s => s.id !== id));
    const thisYear = new Date().getFullYear();
    if (deleted && deleted.date.startsWith(String(thisYear))) {
      if (deleted.shiftType === 'pto')  setPtoUsed(prev => Math.max(0, prev - 1));
      if (deleted.shiftType === 'sick') setSickDaysUsed(prev => Math.max(0, prev - 1));
    }
  };

  const logActualHours = async (id: string, actualStartTime: string, actualEndTime: string, isStat: boolean) => {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        actual_start_time: actualStartTime || null,
        actual_end_time:   actualEndTime   || null,
        is_stat:           isStat,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    setShifts(prev => prev.map(s => s.id === id ? rowToShift(data as Record<string, unknown>) : s));
  };

  // ── Permissions ────────────────────────────────────────────────────────────

  const canEditShift = (shift: Shift): boolean => {
    if (!user) return false;
    if (user.role === 'Branch Manager' || user.role === 'Operations Manager') return true;
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
    if (viewMode === 'week') {
      const { start, end } = getWeekBounds(currentDate);
      loadShifts(toISO(start), toISO(end));
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      loadShifts(toISO(start), toISO(end));
    }
  }, [currentDate, viewMode, loadShifts]);

  return (
    <ScheduleContext.Provider value={{
      shifts, loading, viewMode, currentDate, isPeakSeason,
      ptoEntitlement, ptoUsed, sickDaysUsed,
      setViewMode, setCurrentDate,
      goToPrev, goToNext, goToToday, togglePeakSeason, updatePtoEntitlement,
      createShift, bulkCreateShifts, updateShift, deleteShift, logActualHours,
      canEditShift, refresh,
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
