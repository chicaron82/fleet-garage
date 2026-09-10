import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useIssueContext } from '../../context/IssueContext';
import { usePendingWritesContext } from '../../context/PendingWritesContext';
import { useSchedule } from '../../context/ScheduleContext';
import { localDateStr } from '../../hooks/useFleetBalance';
import { useFleetBalanceContext } from '../../context/FleetBalanceContext';
import { shiftDayStartISO, shiftDayWindow } from '../../lib/shiftDay';
import { resolveActiveLog, deriveVsaProductivity, deriveDriverWeek, type BackfillLog } from '../../lib/sidebarProductivity';
import { getNavItemsForRole } from '../../lib/navigation';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { loadSidebarPrefs, saveSidebarPrefs, clearSidebarPrefs, fetchSidebarPrefs, syncSidebarPrefs } from '../../lib/sidebarPrefs';
import { supabase } from '../../lib/supabase';
import { mapHandoffNote } from '../../lib/garage-mappers';
import { arrayMove } from '@dnd-kit/sortable';
import type { Module, HandoffNote, ShiftType } from '../../types';
import type { NavItem } from '../../lib/navigation';

export function useSidebar() {
  const { user, activeBranch } = useAuth();
  const { vehicles } = useVehicleHoldContext();
  const { washbayLogs, shiftCheckpoints } = useWashbayContext();
  const { facilityIssues } = useIssueContext();
  const { isPeakSeason } = useSchedule();
  const { getTodayEntry, getProjection } = useFleetBalanceContext();
  const { pending } = usePendingWritesContext();

  const todayFleetEntry  = getTodayEntry();
  const fleetProjection  = getProjection();
  const openHighIssues  = facilityIssues.filter(i => !i.clearedAt && i.severity === 'high').length;
  const heldVehicles    = vehicles.filter(v => v.status === 'HELD').length;
  const MODULE_BADGES: Partial<Record<Module, number>> = {
    'holds': heldVehicles,
    'issue-log':    openHighIssues,
    // Effie's staged writes waiting for review (mirrors the "Pending — Effie" section on My Shift).
    'my-shift':     pending.length,
  };

  const [editMode, setEditMode]                 = useState(false);
  const [localOrder, setLocalOrder]             = useState<Module[]>([]);
  const [hidden, setHidden]                     = useState<Module[]>([]);
  const [driverWeekTrips, setDriverWeekTrips]   = useState<{ depart_time: string }[]>([]);
  const [offStandardEntries, setOffStandardEntries] = useState<{ minutes: number; startTime: string }[]>([]);
  const [latestBackfill, setLatestBackfill]     = useState<BackfillLog | null>(null);
  const [todayHandoff, setTodayHandoff]         = useState<HandoffNote | null>(null);
  const [userShiftType, setUserShiftType]       = useState<ShiftType | null>(null);

  // ── Washbay backfill loader (VSA/Lead VSA) ──────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== 'VSA' && user.role !== 'Lead VSA')) return;
    let query = supabase.from('washbay_backfill_logs').select('*').order('date', { ascending: false }).limit(1);
    if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
    query.maybeSingle().then(({ data }) => setLatestBackfill(data));
  }, [user?.id, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active-log selection + all productivity math live in lib/sidebarProductivity
  // (pure, tested) — this hook owns I/O and wiring only.
  const activeLog = resolveActiveLog(washbayLogs, latestBackfill);
  const recentLogDate = activeLog?.date;

  // ── Driver week trips loader ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'Driver') return;
    let q = supabase
      .from('vsa_trips')
      .select('depart_time')
      .is('voided_at', null)   // a voided send did not happen
      .eq('driver_id', user.id)
      .gte('depart_time', shiftDayStartISO(localDateStr(-6)));
    if (activeBranch !== 'ALL') q = q.eq('branch_id', activeBranch);
    q.then(({ data }) => setDriverWeekTrips((data ?? []) as { depart_time: string }[]));
  }, [user?.id, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Off-standard entries loader ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== 'VSA' && user.role !== 'Lead VSA') || !recentLogDate) return;
    supabase
      .from('off_standard_entries')
      .select('minutes, start_time')
      .eq('user_id', user.id)
      .eq('date', recentLogDate)
      .or('is_backdated.is.null,is_backdated.eq.false,edit_status.eq.approved')
      .then(({ data }) => {
        setOffStandardEntries((data ?? []).map(e => ({
          minutes: e.minutes ?? 0,
          startTime: e.start_time,
        })));
      });
  }, [user?.id, recentLogDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handoff note loader ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== 'VSA' && user.role !== 'Lead VSA') || !recentLogDate) return;
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    supabase
      .from('handoff_notes')
      .select('*')
      .eq('branch_id', branchId)
      .gte('logged_at', shiftDayWindow(recentLogDate).startISO)
      .lt('logged_at', shiftDayWindow(recentLogDate).endISO)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        try {
          setTodayHandoff(data ? mapHandoffNote(data as Record<string, unknown>) : null);
        } catch { setTodayHandoff(null); }
      });
  }, [user?.id, activeBranch, recentLogDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shift type loader ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== 'VSA' && user.role !== 'Lead VSA') || !recentLogDate) return;
    supabase
      .from('shifts')
      .select('shift_type')
      .eq('user_id', user.id)
      .eq('date', recentLogDate)
      .maybeSingle()
      .then(({ data }) => setUserShiftType((data?.shift_type as ShiftType) ?? null));
  }, [user?.id, recentLogDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nav prefs loader ─────────────────────────────────────────────────────────
  const defaultNavItems = getNavItemsForRole(user?.role ?? 'Driver', activeBranch);
  const defaultOrder    = defaultNavItems.map(i => i.module);

  useEffect(() => {
    if (!user) return;
    const applyPrefs = (saved: { order: Module[]; hidden: Module[] } | null) => {
      if (saved) {
        const newModules = defaultOrder.filter(
          m => !saved.order.includes(m) && !saved.hidden.includes(m)
        );
        setLocalOrder([...saved.order, ...newModules]);
        setHidden(saved.hidden);
      } else {
        setLocalOrder(defaultOrder);
        setHidden([]);
      }
    };
    applyPrefs(loadSidebarPrefs(user.id));
    fetchSidebarPrefs(user.id).then(remote => {
      if (remote) { applyPrefs(remote); saveSidebarPrefs(user.id, remote); }
    });
  }, [user?.id, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Productivity readouts (pure math in lib/sidebarProductivity) ────────────
  const vsa = deriveVsaProductivity({
    activeLog, offStandardEntries, todayHandoff, shiftCheckpoints,
    userShiftType, isPeakSeason, washbayLogs,
  });
  const { tripsToday, weekAvgTrips } = deriveDriverWeek(driverWeekTrips);
  const deltaColor = vsa.delta != null
    ? (vsa.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')
    : '';

  // ── Nav item lists ───────────────────────────────────────────────────────────
  const displayedItems = localOrder
    .filter(m => !hidden.includes(m))
    .map(m => defaultNavItems.find(i => i.module === m))
    .filter(Boolean) as NavItem[];

  const allItems = [
    ...localOrder.filter(m => !hidden.includes(m)).map(m => defaultNavItems.find(i => i.module === m)).filter(Boolean) as NavItem[],
    ...hidden.map(m => defaultNavItems.find(i => i.module === m)).filter(Boolean) as NavItem[],
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleDragEnd = (active: string, over: string) => {
    if (active === over) return;
    hapticMedium();
    const oldIndex = localOrder.indexOf(active as Module);
    const newIndex = localOrder.indexOf(over as Module);
    setLocalOrder(arrayMove(localOrder, oldIndex, newIndex));
  };

  const toggleHidden = (module: Module) => {
    if (module === 'holds') return;
    hapticLight();
    setHidden(h => h.includes(module) ? h.filter(m => m !== module) : [...h, module]);
  };

  const handleSave = () => {
    if (!user) return;
    hapticMedium();
    const prefs = { order: localOrder, hidden };
    saveSidebarPrefs(user.id, prefs);
    syncSidebarPrefs(user.id, prefs);
    setEditMode(false);
  };

  const handleReset = () => {
    if (!user) return;
    hapticLight();
    clearSidebarPrefs(user.id);
    syncSidebarPrefs(user.id, { order: defaultOrder, hidden: [] });
    setLocalOrder(defaultOrder);
    setHidden([]);
    setEditMode(false);
  };

  return {
    user, activeBranch,
    todayFleetEntry, fleetProjection, MODULE_BADGES,
    editMode, setEditMode,
    localOrder, hidden,
    // VSA productivity
    recentRate: vsa.resolvedRate, recentLabel: vsa.recentLabel,
    resolvedShiftIcon: vsa.resolvedShiftIcon, userShiftType,
    morningRate: vsa.morningRate, closingRate: vsa.closingRate,
    hasSplit: vsa.hasSplit, dailyRate: vsa.dailyRate,
    weekAvgRate: vsa.weekAvgRate, deltaLabel: vsa.deltaLabel, deltaColor,
    // Driver productivity
    tripsToday, weekAvgTrips,
    // Nav
    displayedItems, allItems,
    // Handlers
    handleDragEnd, toggleHidden, handleSave, handleReset,
  };
}
