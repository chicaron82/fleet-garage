import { useState, useMemo, useEffect } from 'react';
import { useSchedule, getWeekBounds, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { SCHEDULE_GROUPS } from '../../lib/scheduleGroups';
import type { ScheduleGroup } from '../../lib/scheduleGroups';
import { WeekView } from './WeekView';
import { CalendarView } from './CalendarView';
import { ScheduleFilterBar } from './ScheduleFilterBar';
import { useMyShiftFilter } from './useMyShiftFilter';
import { FillScheduleModal } from './FillScheduleModal';
import { ScheduleImportModal } from './ScheduleImportModal';
import { LogSickDaySheet } from './LogSickDaySheet';
import { RosterStaffModal } from './RosterStaffModal';
import { SICK_DAYS_ENTITLEMENT } from '../../lib/payEstimate';
import { isMockPersona } from '../../lib/demo-accounts';
import { PtoRequestActionSheet } from './PtoRequestActionSheet';
import { canManageSchedule } from '../../types';

function weekLabel(date: Date): string {
  const { start, end } = getWeekBounds(date);
  const s = start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-CA',   { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

// The schedule remembers which staff group(s) you last viewed, so it opens on
// your team instead of just yourself. First load defaults to Floor (the crew the
// schedule is mostly about) rather than an empty grid.
const GROUPS_KEY = 'fg.schedule.groups';
function loadGroups(): Set<ScheduleGroup> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (raw) return new Set(JSON.parse(raw) as ScheduleGroup[]);
  } catch { /* ignore */ }
  return new Set<ScheduleGroup>(['floor']);
}

// Demo/mock personas (the UV7 crew accounts) are hidden from the schedule by
// default; this remembers when they've been toggled back on for a demo.
const SHOW_MOCK_KEY = 'fg.schedule.showMock';
function loadShowMock(): boolean {
  try { return localStorage.getItem(SHOW_MOCK_KEY) === '1'; } catch { return false; }
}

export function ScheduleScreen({ openImport }: { openImport?: boolean }) {
  const { viewMode, setViewMode, currentDate, goToPrev, goToNext, goToToday, shifts, isPeakSeason, togglePeakSeason, ptoEntitlement, ptoUsed, sickDaysUsed, updatePtoEntitlement } = useSchedule();
  const { user, activeBranch } = useAuth();
  const teamMembers = useTeamMembers();
  const [showFill,    setShowFill]    = useState(false);
  // Deep-link from the assistant's "import the schedule?" bridge opens the importer —
  // but only for managers (same gate as the button); a non-manager deep-link no-ops.
  const [showImport,  setShowImport]  = useState(() => !!openImport && !!user && canManageSchedule(user.role));
  const [showLogSick, setShowLogSick] = useState(false);
  const [showRoster,  setShowRoster]  = useState(false);
  const [togglingPeak, setTogglingPeak] = useState(false);
  const [editingPto,   setEditingPto]   = useState(false);
  const [ptoInput,     setPtoInput]     = useState('');
  const [activeGroups, setActiveGroups] = useState<Set<ScheduleGroup>>(loadGroups);
  const [showPtoSheet, setShowPtoSheet] = useState(false);
  const [showMock, setShowMock] = useState(loadShowMock);
  useEffect(() => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify([...activeGroups])); } catch { /* ignore */ }
  }, [activeGroups]);
  useEffect(() => {
    try { localStorage.setItem(SHOW_MOCK_KEY, showMock ? '1' : '0'); } catch { /* ignore */ }
  }, [showMock]);
  const isManager = user?.role === 'Branch Manager' || user?.role === 'Operations Manager';
  const canSchedule = user ? canManageSchedule(user.role) : false;
  const today = toISO(new Date());

  const toggleGroup = (g: ScheduleGroup) => {
    setActiveGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const visibleUserIds = useMemo(() => {
    const ids = new Set<string>(user ? [user.id] : []);
    for (const g of activeGroups) {
      const group = SCHEDULE_GROUPS.find(sg => sg.id === g);
      if (!group) continue;
      for (const u of teamMembers) {
        if (group.roles.includes(u.role) && u.id !== user?.id && (showMock || !isMockPersona(u))) {
          if (activeBranch === 'ALL' || u.branchId === activeBranch) {
            ids.add(u.id);
          }
        }
      }
    }
    return ids;
  }, [activeGroups, user, activeBranch, teamMembers, showMock]);
  const isCurrentPeriod = viewMode === 'week'
    ? (() => { const { start, end } = getWeekBounds(new Date()); return toISO(currentDate) >= toISO(start) && toISO(currentDate) <= toISO(end); })()
    : currentDate.getFullYear() === new Date().getFullYear() && currentDate.getMonth() === new Date().getMonth();

  const myShift = useMyShiftFilter({ shifts, teamMembers, user, today, viewMode, isCurrentPeriod, showMock, activeBranch });
  const effectiveVisibleIds = myShift.visibleIds ?? visibleUserIds;

  const label = viewMode === 'week' ? weekLabel(currentDate) : monthLabel(currentDate);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <ModuleHeader
        title="Schedule"
        action={
          <div className="flex items-center gap-2">
            {/* View toggle — the one control that earns a spot by the title;
                roster/fill/import moved below the legend to declutter the header */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 transition cursor-pointer ${
                  viewMode === 'week'
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 transition cursor-pointer border-l border-gray-200 dark:border-gray-700 ${
                  viewMode === 'calendar'
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                Calendar
              </button>
            </div>
          </div>
        }
      />

      {/* Peak season banner — managers only */}
      {isManager && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          isPeakSeason
            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
            : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}>
          <span>
            {isPeakSeason ? '☀️ Peak season active' : 'Peak season off'}
            <span className="ml-1.5 font-normal opacity-70">
              {isPeakSeason ? '— closing defaults 14:30–23:00' : '— closing defaults 13:30–22:00'}
            </span>
          </span>
          <button
            onClick={async () => {
              setTogglingPeak(true);
              try { await togglePeakSeason(); } finally { setTogglingPeak(false); }
            }}
            disabled={togglingPeak}
            className="ml-3 px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 border border-current text-current font-semibold hover:opacity-80 disabled:opacity-40 transition cursor-pointer"
          >
            {togglingPeak ? '…' : isPeakSeason ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      )}

      {/* PTO + Sick stats */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* PTO chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 text-xs">
          <span className="text-violet-700 dark:text-violet-300 font-semibold">PTO</span>
          <span className="text-violet-600 dark:text-violet-400">{ptoUsed} /</span>
          {editingPto ? (
            <input
              autoFocus
              type="number"
              min={1}
              max={365}
              value={ptoInput}
              onChange={e => setPtoInput(e.target.value)}
              onBlur={async () => {
                const v = parseInt(ptoInput, 10);
                if (!isNaN(v) && v > 0) await updatePtoEntitlement(v);
                setEditingPto(false);
              }}
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  const v = parseInt(ptoInput, 10);
                  if (!isNaN(v) && v > 0) await updatePtoEntitlement(v);
                  setEditingPto(false);
                } else if (e.key === 'Escape') {
                  setEditingPto(false);
                }
              }}
              className="w-10 text-center font-bold text-violet-700 dark:text-violet-300 bg-transparent border-b border-violet-400 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => { setPtoInput(String(ptoEntitlement)); setEditingPto(true); }}
              className="font-bold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer"
              title="Tap to set your PTO entitlement"
            >
              {ptoEntitlement}
            </button>
          )}
          <span className="text-violet-500 dark:text-violet-500">· {Math.max(0, ptoEntitlement - ptoUsed)} left</span>
        </div>

        {/* Share PTO request */}
        <button
          onClick={() => setShowPtoSheet(true)}
          disabled={ptoUsed === 0}
          title={ptoUsed === 0 ? 'Add PTO days to your schedule first' : 'Share your upcoming PTO as a request for approval'}
          className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline whitespace-nowrap"
        >
          Share PTO request ↗
        </button>

        {/* Sick chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-xs">
          <span className="text-rose-700 dark:text-rose-300 font-semibold">Sick</span>
          <span className="text-rose-600 dark:text-rose-400">{sickDaysUsed}/{SICK_DAYS_ENTITLEMENT}</span>
        </div>

        {/* Log sick day */}
        <button
          onClick={() => setShowLogSick(true)}
          className="ml-auto text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer whitespace-nowrap"
        >
          Log sick day ↓
        </button>
      </div>

      {/* Group view filter */}
      <ScheduleFilterBar
        activeGroups={activeGroups}
        onToggleGroup={toggleGroup}
        showMock={showMock}
        onToggleMock={() => setShowMock(v => !v)}
        myShift={{
          show: myShift.show,
          available: myShift.available,
          active: myShift.active,
          tooltip: myShift.available ? 'Only crew who overlap your shift today' : 'No shift entered for today',
          onToggle: myShift.toggle,
        }}
      />

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-sm"
        >
          ‹
        </button>
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{label}</span>
        {!isCurrentPeriod && (
          <button
            onClick={goToToday}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer"
          >
            Today
          </button>
        )}
        {/* Next stays rightmost so repeated taps keep advancing — "Today" slots in
            to its left rather than hijacking the forward-tap location. */}
        <button
          onClick={goToNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-sm"
        >
          ›
        </button>
      </div>

      {/* Content */}
      {viewMode === 'week'
        ? <WeekView today={today} visibleUserIds={effectiveVisibleIds} overlaps={myShift.overlaps} />
        : <CalendarView today={today} visibleUserIds={effectiveVisibleIds} />
      }

      {/* Schedule admin — setup actions, tucked under the legend and out of the title row */}
      <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-gray-100 dark:border-gray-800">
        {canSchedule && (
          <button
            onClick={() => setShowRoster(true)}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            Roster staff
          </button>
        )}
        <button
          onClick={() => setShowFill(true)}
          className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer whitespace-nowrap"
        >
          Fill range ↓
        </button>
        {canSchedule && (
          <button
            onClick={() => setShowImport(true)}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            Import 📷
          </button>
        )}
      </div>

      {showFill    && <FillScheduleModal onClose={() => setShowFill(false)} />}
      {showImport  && <ScheduleImportModal onClose={() => setShowImport(false)} />}
      {showLogSick && <LogSickDaySheet   onClose={() => setShowLogSick(false)} />}
      {showRoster  && <RosterStaffModal  onClose={() => setShowRoster(false)} />}
      {showPtoSheet && user && (
        <PtoRequestActionSheet user={user} entitlement={ptoEntitlement} used={ptoUsed} onClose={() => setShowPtoSheet(false)} />
      )}
    </div>
  );
}
