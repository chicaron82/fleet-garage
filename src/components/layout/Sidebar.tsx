import { useState, useRef, useEffect } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { useAuth } from '../../context/AuthContext';
import { useGarage } from '../../context/GarageContext';
import { useSchedule } from '../../context/ScheduleContext';
import { useFleetBalance, localDateStr } from '../../hooks/useFleetBalance';
import { UserProfileMenu } from '../UserProfileMenu';
import { getNavItemsForRole } from '../../lib/navigation';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { loadSidebarPrefs, saveSidebarPrefs, clearSidebarPrefs, fetchSidebarPrefs, syncSidebarPrefs } from '../../lib/sidebarPrefs';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { mapHandoffNote } from '../../lib/garage-mappers';
import type { Module, Screen, BranchId, UserRole, HandoffNote, ShiftType } from '../../types';
import type { NavItem } from '../../lib/navigation';
import type { MockNotification } from '../../data/notifications';

import { useNavigatorOnLine } from '../../hooks/useNavigatorOnLine';
import { BRANCH_CONFIGS } from '../../data/mock';
import { SortableNavItem, restrictToVerticalAxis } from './SortableNavItem';
import { SidebarNotificationPopover } from './SidebarNotificationPopover';
import type { LiveNotification } from './SidebarNotificationPopover';

interface LiveNotification {
  id: string; branch_id: string; recipient_roles: UserRole[];
  icon: string; text: string; is_read: boolean; read_by: string[];
  created_at: string;
}

interface Props {
  activeModule: Module;
  onNavigate: (screen: Screen) => void;
  onClose?: () => void;
  onShowGuide?: (module: Module) => void;
  notifications: MockNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
}



export function Sidebar({ activeModule, onNavigate, onClose, onShowGuide, notifications, unreadCount, onMarkAllRead }: Props) {
  const { user, activeBranch, setActiveBranch } = useAuth();
  const isOnline = useNavigatorOnLine();
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
  const [editMode, setEditMode]               = useState(false);
  const [localOrder, setLocalOrder]           = useState<Module[]>([]);
  const [hidden, setHidden]                   = useState<Module[]>([]);
  const [driverWeekTrips, setDriverWeekTrips]     = useState<{ depart_time: string }[]>([]);
  const [offStandardEntries, setOffStandardEntries] = useState<{ minutes: number; startTime: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [latestBackfill, setLatestBackfill] = useState<any>(null);
  const [todayHandoff, setTodayHandoff] = useState<HandoffNote | null>(null);
  const [userShiftType, setUserShiftType] = useState<ShiftType | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

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

  // Fetch today's handoff note for the active date
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

  // Fetch user's shift type for the active date
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

    // Sync localStorage load — immediate, no flicker
    applyPrefs(loadSidebarPrefs(user.id));

    // Async Supabase hydration — overrides if remote row exists
    fetchSidebarPrefs(user.id).then(remote => {
      if (remote) {
        applyPrefs(remote);
        saveSidebarPrefs(user.id, remote);
      }
    });
  }, [user?.id, activeBranch]); // eslint-disable-line react-hooks/exhaustive-deps


  if (!user) return null;

  const isVSA    = user.role === 'VSA' || user.role === 'Lead VSA';
  const isDriver = user.role === 'Driver';

  // ── VSA productivity strip derivations ────────────────────────────────────
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

  // ── Morning / Closing split rates ──────────────────────────────────────────
  const morningCleaned = todayHandoff
    ? todayHandoff.fullPages * 19 + todayHandoff.lastPageEntries
    : null;
  const morningOpHours = todayHandoff
    ? todayHandoff.morningHours ?? 8.0
    : null;
  const activeCheckpoint = shiftCheckpoints.find(c => c.date === recentLogDate && c.checkpointType === 'closing_arrival') ?? null;
  const checkpointCount  = activeCheckpoint ? activeCheckpoint.fullPages * 19 + activeCheckpoint.lastPageEntries : null;
  const closingStartCount = checkpointCount ?? morningCleaned;
  const closingCleaned = closingStartCount != null && carsCleaned != null
    ? Math.max(0, carsCleaned - closingStartCount)
    : null;
  // Closing crew always works 8h (13:30–22:00 non-peak, 14:30–23:00 peak).
  // The branch operating span overlaps with morning, so closingOpHours is independent of morningOpHours.
  const closingOpHours: number | null = morningOpHours != null ? 8.0 : null;

  // Per-window OTH partitioning — assign each entry to the window its startTime falls in
  const handoffTimestamp = todayHandoff
    ? (() => {
        const dateStr = new Date(todayHandoff.loggedAt).toLocaleDateString('en-CA');
        return new Date(`${dateStr}T15:15:00`);
      })()
    : null;
  const morningOTH = handoffTimestamp
    ? offStandardEntries.filter(e => new Date(e.startTime) < handoffTimestamp).reduce((s, e) => s + e.minutes, 0)
    : offStandardMinutes;
  const closingOTH = handoffTimestamp
    ? offStandardEntries.filter(e => new Date(e.startTime) >= handoffTimestamp).reduce((s, e) => s + e.minutes, 0)
    : 0;

  const morningAdjustedHours = morningOpHours != null ? Math.max(0.1, morningOpHours - morningOTH / 60) : null;
  const closingAdjustedHours = closingOpHours != null ? Math.max(0.1, closingOpHours - closingOTH / 60) : null;

  const morningRate  = morningCleaned != null && morningAdjustedHours != null
    ? Math.round((morningCleaned / morningAdjustedHours) * 10) / 10
    : null;
  const closingRate  = closingCleaned != null && closingAdjustedHours != null
    ? Math.round((closingCleaned / closingAdjustedHours) * 10) / 10
    : null;

  // Resolve which rate to display based on handoff + schedule
  const hasSplit = morningRate != null && closingRate != null;
  const resolvedRate = hasSplit && userShiftType
    ? userShiftType === 'opening' ? morningRate
    : userShiftType === 'closing' ? closingRate
    : dailyRate
    : dailyRate;
  const resolvedShiftIcon = hasSplit && userShiftType === 'opening' ? '☀️'
    : hasSplit && userShiftType === 'closing' ? '🌙'
    : null;

  const recentRate = resolvedRate;
    
  const recentLabel   = recentLogDate === localDateStr(0)  ? 'Earlier today'
                      : recentLogDate === localDateStr(-1) ? 'Yesterday'
                      : recentLogDate ?? 'Last shift';

  const weekLogs    = washbayLogs
    .filter(l => l.date >= localDateStr(-7) && l.date < localDateStr(0))
    .filter(l => l.fullPages > 0 || l.lastPageEntries > 0);
  const weekAvgRate = weekLogs.length >= 3
    ? Math.round(weekLogs.reduce((s, l) => {
        const ci = l.fullPages * 19 + l.lastPageEntries;
        const throughput = (ci - l.carsRemaining) / (isPeakSeason ? 16 : 15 + l.overtimeHours);
        return s + throughput;
      }, 0) / weekLogs.length * 10) / 10
    : null;

  const delta      = recentRate != null && weekAvgRate != null
    ? Math.round((recentRate - weekAvgRate) * 10) / 10
    : null;
  const deltaLabel = delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) : null;
  const deltaColor = delta != null
    ? delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
    : '';

  // ── Driver productivity strip derivations ──────────────────────────────────
  const tripsToday = driverWeekTrips.filter(t => t.depart_time.startsWith(localDateStr(0))).length;
  const byDay      = driverWeekTrips.reduce((acc, t) => {
    const date = t.depart_time.split('T')[0];
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const weekAvgTrips = Object.keys(byDay).length >= 3
    ? Math.round(Object.values(byDay).reduce((s, n) => s + n, 0) / Object.keys(byDay).length * 10) / 10
    : null;



  const displayedItems = localOrder
    .filter(m => !hidden.includes(m))
    .map(m => defaultNavItems.find(i => i.module === m))
    .filter(Boolean) as NavItem[];

  const allItems = [
    ...localOrder.filter(m => !hidden.includes(m)).map(m => defaultNavItems.find(i => i.module === m)).filter(Boolean) as NavItem[],
    ...hidden.map(m => defaultNavItems.find(i => i.module === m)).filter(Boolean) as NavItem[],
  ];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    hapticMedium();
    const oldIndex = localOrder.indexOf(active.id as Module);
    const newIndex = localOrder.indexOf(over.id as Module);
    setLocalOrder(arrayMove(localOrder, oldIndex, newIndex));
  };

  const toggleHidden = (module: Module) => {
    if (module === 'fleet-garage') return;
    hapticLight();
    if (hidden.includes(module)) {
      setHidden(h => h.filter(m => m !== module));
    } else {
      setHidden(h => [...h, module]);
    }
  };

  const handleSave = () => {
    hapticMedium();
    const prefs = { order: localOrder, hidden };
    saveSidebarPrefs(user.id, prefs);
    syncSidebarPrefs(user.id, prefs);
    setEditMode(false);
  };

  const handleReset = () => {
    hapticLight();
    clearSidebarPrefs(user.id);
    syncSidebarPrefs(user.id, { order: defaultOrder, hidden: [] });
    setLocalOrder(defaultOrder);
    setHidden([]);
    setEditMode(false);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-colors">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-yellow-400 dark:bg-yellow-500 rounded-lg flex items-center justify-center transition-colors relative">
            <span className="text-black font-bold text-xs">FG</span>
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900 transition-colors ${
                isOnline ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight transition-colors">Fleet Garage</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight transition-colors">
              {activeBranch === 'ALL' ? 'Ops Pilot Program' : `${activeBranch} Ops Pilot Program`}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Fleet balance strip — non-management only */}
      {!['Branch Manager', 'Operations Manager', 'City Manager'].includes(user.role) && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {todayFleetEntry ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Fleet Today</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Out</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{todayFleetEntry.outCount}</span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">In</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{todayFleetEntry.inCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">No fleet numbers today</p>
          )}
        </div>
      )}

      {/* VSA productivity strip */}
      {isVSA && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {recentRate != null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {resolvedShiftIcon ? `${resolvedShiftIcon} ` : ''}{recentLabel}{resolvedShiftIcon && userShiftType ? ` (${userShiftType})` : ''}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{recentRate}/hr</span>
                {deltaLabel && (
                  <span className={`text-xs font-semibold ${deltaColor}`}>{deltaLabel}</span>
                )}
              </div>
              {hasSplit && !userShiftType && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">☀️ AM: {morningRate}/hr</span>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">🌙 PM: {closingRate}/hr</span>
                </div>
              )}
              {!hasSplit && userShiftType && dailyRate != null && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {userShiftType === 'opening' ? '☀️ AM' : '🌙 PM'}: {dailyRate}/hr
                  </span>
                </div>
              )}
              {weekAvgRate != null && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">This week avg: {weekAvgRate}/hr</p>
              )}
            </>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No closing log yet</p>
          )}
        </div>
      )}

      {/* Driver productivity strip */}
      {isDriver && (
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Trips Today</span>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
              {tripsToday === 0 ? '0 runs logged' : `${tripsToday} run${tripsToday !== 1 ? 's' : ''}`}
            </span>
          </div>
          {weekAvgTrips != null && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">This week avg: {weekAvgTrips} trips/day</p>
          )}
        </div>
      )}

      {/* Branch Selector */}
      {user.role === 'City Manager' && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Active Branch
          </label>
          <select
            value={activeBranch}
            onChange={(e) => setActiveBranch(e.target.value as BranchId)}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors cursor-pointer"
          >
            {Object.values(BRANCH_CONFIGS).map(config => (
              <option key={config.id} value={config.id}>{config.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">

        {/* Normal mode */}
        {!editMode && displayedItems.map(item => {
          const isActive = activeModule === item.module;
          return (
            <div key={item.module} className="relative flex items-center group">
              <button
                onClick={() => onNavigate(item.defaultScreen)}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
                {MODULE_BADGES[item.module] ? (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shrink-0">
                    {MODULE_BADGES[item.module]}
                  </span>
                ) : null}
              </button>
              {onShowGuide && (
                <button
                  onClick={e => { e.stopPropagation(); hapticLight(); onShowGuide(item.module); }}
                  className="absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 cursor-pointer"
                  title={`About ${item.label}`}
                >
                  <span className="text-xs">ⓘ</span>
                </button>
              )}
            </div>
          );
        })}

        {/* Edit mode */}
        {editMode && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {allItems.map(item => (
                  <SortableNavItem
                    key={item.module}
                    item={item}
                    isHidden={hidden.includes(item.module)}
                    onToggleHidden={() => toggleHidden(item.module)}
                    badge={MODULE_BADGES[item.module]}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

      </nav>

      {/* Edit / Save / Reset Controls */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 space-y-1">
        {!editMode ? (
          <button
            type="button"
            onClick={() => { hapticLight(); setEditMode(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span>⚙️</span>
            <span>Edit Menu</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 rounded-lg bg-yellow-400 dark:bg-yellow-500 text-black text-xs font-semibold transition hover:bg-yellow-500 cursor-pointer"
            >
              ✓ Save
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
              title="Reset to default"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* User Section — desktop only */}
      <div className="hidden md:block border-t border-gray-100 dark:border-gray-800 px-3 py-3">
        <SidebarNotificationPopover
          user={user}
          unreadCount={unreadCount}
          notifications={notifications}
          liveNotifs={liveNotifs}
          notifMode={notifMode}
          setNotifMode={setNotifMode}
          desktopInboxOpen={desktopInboxOpen}
          setDesktopInboxOpen={setDesktopInboxOpen}
          onMarkAllRead={onMarkAllRead}
          handleMarkLiveAllRead={handleMarkLiveAllRead}
          popoverRef={popoverRef}
        />

        <UserProfileMenu dropUp />
      </div>
    </div>
  );
}
