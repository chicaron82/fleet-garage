import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useIssueContext } from '../../context/IssueContext';
import { useSchedule } from '../../context/ScheduleContext';
import { localDateStr } from '../../hooks/useFleetBalance';
import { useFleetBalanceContext } from '../../context/FleetBalanceContext';
import { shiftDayStartISO, shiftDayWindow } from '../../lib/shiftDay';
import { resolveActiveLog, deriveVsaProductivity, deriveDriverWeek, type BackfillLog } from '../../lib/sidebarProductivity';
import { getNavItemsForRole } from '../../lib/navigation';
import { isRealAccount } from '../../lib/demo-accounts';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { loadSidebarPrefs, saveSidebarPrefs, clearSidebarPrefs, fetchSidebarPrefs, syncSidebarPrefs } from '../../lib/sidebarPrefs';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { mapHandoffNote } from '../../lib/garage-mappers';
import { arrayMove } from '@dnd-kit/sortable';
import type { Module, HandoffNote, ShiftType } from '../../types';
import type { NavItem } from '../../lib/navigation';
import type { LiveNotification } from './SidebarNotificationPopover';

export function useSidebar() {
  const { user, activeBranch } = useAuth();
  const { vehicles } = useVehicleHoldContext();
  const { washbayLogs, shiftCheckpoints } = useWashbayContext();
  const { facilityIssues } = useIssueContext();
  const { isPeakSeason } = useSchedule();
  const { getTodayEntry, getProjection } = useFleetBalanceContext();

  const todayFleetEntry  = getTodayEntry();
  const fleetProjection  = getProjection();
  const openHighIssues  = facilityIssues.filter(i => !i.clearedAt && i.severity === 'high').length;
  const heldVehicles    = vehicles.filter(v => v.status === 'HELD').length;
  const MODULE_BADGES: Partial<Record<Module, number>> = {
    'holds': heldVehicles,
    'issue-log':    openHighIssues,
  };

  const [desktopInboxOpen, setDesktopInboxOpen] = useState(false);
  const [notifMode, setNotifMode]               = useState<'demo' | 'live'>('live');
  const [liveNotifs, setLiveNotifs]             = useState<LiveNotification[]>([]);
  const [editMode, setEditMode]                 = useState(false);
  const [localOrder, setLocalOrder]             = useState<Module[]>([]);
  const [hidden, setHidden]                     = useState<Module[]>([]);
  const [driverWeekTrips, setDriverWeekTrips]   = useState<{ depart_time: string }[]>([]);
  const [offStandardEntries, setOffStandardEntries] = useState<{ minutes: number; startTime: string }[]>([]);
  const [latestBackfill, setLatestBackfill]     = useState<BackfillLog | null>(null);
  const [todayHandoff, setTodayHandoff]         = useState<HandoffNote | null>(null);
  const [userShiftType, setUserShiftType]       = useState<ShiftType | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Click-outside handler for notification popover ──────────────────────────
  useEffect(() => {
    if (!desktopInboxOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setDesktopInboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [desktopInboxOpen]);

  // ── Live notifications loader ────────────────────────────────────────────────
  useEffect(() => {
    if (notifMode !== 'live' || !user) return;
    const role = user.role;
    const userId = user.id;
    async function load() {
      let query = supabase
        .from('notifications')
        .select('*')
        .or(`recipient_roles.cs.{${role}},recipient_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
      const { data } = await query;
      setLiveNotifs((data ?? []) as LiveNotification[]);
    }
    load();
  }, [notifMode, user, activeBranch]);

  // ── Live notifications realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (notifMode !== 'live' || !user) return;
    const channel = supabase
      .channel('notifications-sidebar-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as LiveNotification;
        if (activeBranch !== 'ALL' && n.branch_id !== activeBranch) return;
        if (!n.recipient_roles.includes(user.role) && n.recipient_user_id !== user.id) return;
        setLiveNotifs(prev => [n, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        const updated = payload.new as LiveNotification;
        setLiveNotifs(prev => prev.map(l => l.id === updated.id ? updated : l));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [notifMode, user?.id, user?.role, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const defaultNavItems = getNavItemsForRole(user?.role ?? 'Driver', activeBranch, !isRealAccount(user?.employeeId));
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
  const handleMarkLiveAllRead = async () => {
    if (!user) return;
    const unread = liveNotifs.filter(n => !n.read_by.includes(user.id));
    await Promise.all(unread.map(n =>
      writeWithRefresh(() => supabase.rpc('mark_notification_read', { p_notification_id: n.id, p_user_id: user.id }))
    ));
    setLiveNotifs(prev => prev.map(n => ({
      ...n,
      read_by: n.read_by.includes(user.id) ? n.read_by : [...n.read_by, user.id],
    })));
  };

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
    desktopInboxOpen, setDesktopInboxOpen,
    notifMode, setNotifMode,
    liveNotifs,
    editMode, setEditMode,
    localOrder, hidden,
    popoverRef,
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
    handleMarkLiveAllRead, handleDragEnd, toggleHidden, handleSave, handleReset,
  };
}
