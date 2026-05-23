import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGarage } from '../../context/GarageContext';
import { useSchedule } from '../../context/ScheduleContext';
import { useFleetBalance, localDateStr } from '../../hooks/useFleetBalance';
import { getNavItemsForRole } from '../../lib/navigation';
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
  const { facilityIssues, washbayLogs, holds, shiftCheckpoints } = useGarage();
  const { isPeakSeason } = useSchedule();
  const { getTodayEntry } = useFleetBalance();

  const todayFleetEntry = getTodayEntry();
  const openHighIssues  = facilityIssues.filter(i => !i.clearedAt && i.severity === 'high').length;
  const activeHolds     = holds.filter(h => h.status === 'ACTIVE').length;
  const MODULE_BADGES: Partial<Record<Module, number>> = {
    'fleet-garage': activeHolds,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [latestBackfill, setLatestBackfill]     = useState<any>(null);
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
    if (notifMode !== 'live' || !desktopInboxOpen || !user) return;
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
  }, [notifMode, desktopInboxOpen, user, activeBranch]);

  // ── Washbay backfill loader (VSA/Lead VSA) ──────────────────────────────────
  useEffect(() => {
    if (!user || (user.role !== 'VSA' && user.role !== 'Lead VSA')) return;
    let query = supabase.from('washbay_backfill_logs').select('*').order('date', { ascending: false }).limit(1);
    if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
    query.maybeSingle().then(({ data }) => setLatestBackfill(data));
  }, [user?.id, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentPrimary = washbayLogs.length > 0 ? washbayLogs[0] : null;
  const activeLog = (() => {
    if (!recentPrimary && !latestBackfill) return null;
    if (!recentPrimary) return latestBackfill;
    if (!latestBackfill) return recentPrimary;
    return recentPrimary.date >= latestBackfill.date ? recentPrimary : latestBackfill;
  })();
  const recentLogDate = activeLog?.date;

  // ── Driver week trips loader ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== 'Driver') return;
    let q = supabase
      .from('vsa_trips')
      .select('depart_time')
      .eq('driver_id', user.id)
      .gte('depart_time', localDateStr(-6) + 'T00:00:00');
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
      .then(({ data }) => {
        setOffStandardEntries((data ?? []).map((e: { minutes: number; start_time: string }) => ({
          minutes: e.minutes,
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
      .gte('logged_at', recentLogDate + 'T00:00:00')
      .lte('logged_at', recentLogDate + 'T23:59:59')
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

  // ── Derived VSA productivity values ─────────────────────────────────────────
  const isBackfill    = activeLog && 'full_pages' in activeLog;
  const carsIn        = activeLog ? (isBackfill ? activeLog.full_pages * 19 + activeLog.last_page_entries : activeLog.fullPages * 19 + activeLog.lastPageEntries) : null;
  const carsCleaned   = carsIn != null ? carsIn - (isBackfill ? activeLog.cars_remaining : activeLog.carsRemaining) : null;
  const offStandardMinutes = offStandardEntries.reduce((s, e) => s + e.minutes, 0);
  const teamOpHours   = isPeakSeason ? 16 : 15 + (activeLog ? (isBackfill ? activeLog.overtime_hours : activeLog.overtimeHours) : 0);
  const teamThroughput = carsCleaned != null ? carsCleaned / teamOpHours : null;
  const adjustedOpHours = Math.max(0.1, teamOpHours - (offStandardMinutes / 60));
  const dailyRate     = carsCleaned != null
    ? (offStandardMinutes > 0 ? Math.round((carsCleaned / adjustedOpHours) * 10) / 10 : Math.round(teamThroughput! * 10) / 10)
    : null;

  const morningCleaned  = todayHandoff ? todayHandoff.fullPages * 19 + todayHandoff.lastPageEntries : null;
  const morningOpHours  = todayHandoff ? todayHandoff.morningHours ?? 8.0 : null;
  const activeCheckpoint = shiftCheckpoints.find(c => c.date === recentLogDate && c.checkpointType === 'closing_arrival') ?? null;
  const checkpointCount  = activeCheckpoint ? activeCheckpoint.fullPages * 19 + activeCheckpoint.lastPageEntries : null;
  const closingStartCount = checkpointCount ?? morningCleaned;
  const closingCleaned  = closingStartCount != null && carsCleaned != null ? Math.max(0, carsCleaned - closingStartCount) : null;
  const closingOpHours: number | null = morningOpHours != null ? 8.0 : null;

  const handoffTimestamp = todayHandoff
    ? (() => { const dateStr = new Date(todayHandoff.loggedAt).toLocaleDateString('en-CA'); return new Date(`${dateStr}T15:15:00`); })()
    : null;
  const morningOTH = handoffTimestamp
    ? offStandardEntries.filter(e => new Date(e.startTime) < handoffTimestamp).reduce((s, e) => s + e.minutes, 0)
    : offStandardMinutes;
  const closingOTH = handoffTimestamp
    ? offStandardEntries.filter(e => new Date(e.startTime) >= handoffTimestamp).reduce((s, e) => s + e.minutes, 0)
    : 0;

  const morningAdjustedHours = morningOpHours != null ? Math.max(0.1, morningOpHours - morningOTH / 60) : null;
  const closingAdjustedHours = closingOpHours != null ? Math.max(0.1, closingOpHours - closingOTH / 60) : null;
  const morningRate = morningCleaned != null && morningAdjustedHours != null ? Math.round((morningCleaned / morningAdjustedHours) * 10) / 10 : null;
  const closingRate = closingCleaned != null && closingAdjustedHours != null ? Math.round((closingCleaned / closingAdjustedHours) * 10) / 10 : null;

  const hasSplit = morningRate != null && closingRate != null;
  const resolvedRate = hasSplit && userShiftType
    ? userShiftType === 'opening' ? morningRate : userShiftType === 'closing' ? closingRate : dailyRate
    : dailyRate;
  const resolvedShiftIcon = hasSplit && userShiftType === 'opening' ? '☀️'
    : hasSplit && userShiftType === 'closing' ? '🌙' : null;

  const recentLabel = recentLogDate === localDateStr(0)  ? 'Earlier today'
                    : recentLogDate === localDateStr(-1) ? 'Yesterday'
                    : recentLogDate ?? 'Last shift';

  const weekLogs = washbayLogs
    .filter(l => l.date >= localDateStr(-7) && l.date < localDateStr(0))
    .filter(l => l.fullPages > 0 || l.lastPageEntries > 0);
  const weekAvgRate = weekLogs.length >= 3
    ? Math.round(weekLogs.reduce((s, l) => {
        const ci = l.fullPages * 19 + l.lastPageEntries;
        return s + (ci - l.carsRemaining) / (isPeakSeason ? 16 : 15 + l.overtimeHours);
      }, 0) / weekLogs.length * 10) / 10
    : null;

  const delta      = resolvedRate != null && weekAvgRate != null ? Math.round((resolvedRate - weekAvgRate) * 10) / 10 : null;
  const deltaLabel = delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) : null;
  const deltaColor = delta != null ? (delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400') : '';

  // ── Driver productivity derivations ──────────────────────────────────────────
  const tripsToday   = driverWeekTrips.filter(t => t.depart_time.startsWith(localDateStr(0))).length;
  const byDay        = driverWeekTrips.reduce((acc, t) => {
    const date = t.depart_time.split('T')[0];
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const weekAvgTrips = Object.keys(byDay).length >= 3
    ? Math.round(Object.values(byDay).reduce((s, n) => s + n, 0) / Object.keys(byDay).length * 10) / 10
    : null;

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
      writeWithRefresh(() => supabase.from('notifications').update({ read_by: [...n.read_by, user.id] }).eq('id', n.id))
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
    if (module === 'fleet-garage') return;
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
    todayFleetEntry, MODULE_BADGES,
    desktopInboxOpen, setDesktopInboxOpen,
    notifMode, setNotifMode,
    liveNotifs,
    editMode, setEditMode,
    localOrder, hidden,
    popoverRef,
    // VSA productivity
    recentRate: resolvedRate, recentLabel,
    resolvedShiftIcon, userShiftType,
    morningRate, closingRate, hasSplit, dailyRate,
    weekAvgRate, deltaLabel, deltaColor,
    // Driver productivity
    tripsToday, weekAvgTrips,
    // Nav
    displayedItems, allItems,
    // Handlers
    handleMarkLiveAllRead, handleDragEnd, toggleHidden, handleSave, handleReset,
  };
}
