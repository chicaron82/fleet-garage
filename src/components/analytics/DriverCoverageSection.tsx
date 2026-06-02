import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { localDateStr } from '../../hooks/useFleetBalance';
import { shiftDayStartISO } from '../../lib/shiftDay';
import { useWashbayContext } from '../../context/WashbayContext';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { DEMO_DRIVER_COVERAGE } from '../../lib/analytics';
import { SectionHeader } from './AnalyticsComponents';
import { HistoryPanel, type HistoryData, type HistoryRow } from './DriverCoverageHistoryPanel';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveDriverRow {
  userId:      string;
  name:        string;
  shiftStart?: string;  // ISO
  shiftEnd?:   string;  // ISO
  lastArrive?: string;  // ISO
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtShift(startIso?: string, endIso?: string): string {
  if (!startIso && !endIso) return '—';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours(); const m = d.getMinutes();
    const suffix = h >= 12 ? 'p' : 'a';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
  };
  const s = startIso ? fmt(startIso) : '?';
  const e = endIso   ? fmt(endIso)   : '?';
  return `${s}–${e}`;
}

function fmtRunTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const h = d.getHours(); const m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

function calcGap(shiftEndIso?: string, lastArriveIso?: string): number | null {
  if (!shiftEndIso || !lastArriveIso) return null;
  const end  = new Date(shiftEndIso).getTime();
  const last = new Date(lastArriveIso).getTime();
  return Math.round((end - last) / 60000);
}

function rowBg(gap?: number | null, cleans?: number | null): string {
  if (gap == null) return '';
  if (gap >= 40 && cleans != null && cleans > 3) return 'bg-red-50 dark:bg-red-900/20';
  if (gap >= 20 && cleans != null && cleans > 0) return 'bg-amber-50 dark:bg-amber-900/15';
  return '';
}

function gapCls(gap?: number | null, cleans?: number | null): string {
  if (gap == null) return 'text-gray-400 dark:text-gray-500';
  if (gap >= 40 && cleans != null && cleans > 3) return 'text-red-600 dark:text-red-400 font-semibold';
  if (gap >= 20 && cleans != null && cleans > 0) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-gray-700 dark:text-gray-300';
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props { isDemo: boolean; activeBranch: string; }



export function DriverCoverageSection({ isDemo, activeBranch }: Props) {
  const { washbayLogs } = useWashbayContext();
  const teamMembers = useTeamMembers();
  const driverUsers = useMemo(() => teamMembers.filter(u => u.role === 'Driver'), [teamMembers]);
  const [liveRows, setLiveRows]     = useState<LiveDriverRow[]>([]);
  const [loading, setLoading]       = useState(!isDemo);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, HistoryData | null>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const todayStart = shiftDayStartISO(localDateStr(0));
    const driverIds  = driverUsers.map(u => u.id);

    const shiftsQ = supabase
      .from('shifts')
      .select('user_id, start_time, end_time')
      .in('user_id', driverIds)
      .eq('date', localDateStr(0));

    const tripsQ = supabase
      .from('vsa_trips')
      .select('driver_id, arrive_time')
      .in('driver_id', driverIds)
      .gte('depart_time', todayStart)
      .order('arrive_time', { ascending: false });

    Promise.all([shiftsQ, tripsQ]).then(([shiftsRes, tripsRes]) => {
      const shifts = (shiftsRes.data ?? []) as { user_id: string; start_time: string; end_time: string; }[];
      const trips  = (tripsRes.data ?? []) as { driver_id: string; arrive_time: string; }[];

      const lastArriveMap = new Map<string, string>();
      for (const t of trips) {
        if (!lastArriveMap.has(t.driver_id)) lastArriveMap.set(t.driver_id, t.arrive_time);
      }

      const shiftMap = new Map<string, { start_time: string; end_time: string; }>();
      for (const s of shifts) shiftMap.set(s.user_id, s);

      const rows: LiveDriverRow[] = driverUsers
        .filter(u => activeBranch === 'ALL' || u.branchId === activeBranch)
        .map(u => {
          const shift = shiftMap.get(u.id);
          return {
            userId:      u.id,
            name:        u.name,
            shiftStart:  shift?.start_time,
            shiftEnd:    shift?.end_time,
            lastArrive:  lastArriveMap.get(u.id),
          };
        });

      setLiveRows(rows);
      setLoading(false);
    });
  }, [isDemo, activeBranch, driverUsers]);

  async function loadHistory(driverName: string, userId: string) {
    if (driverName in historyData) return;
    setHistoryLoading(driverName);

    const thirtyDaysAgo = localDateStr(-30);
    const driverIds     = [userId];

    const [shiftsRes, tripsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('user_id, start_time, end_time, date')
        .in('user_id', driverIds)
        .gte('date', thirtyDaysAgo),
      supabase
        .from('vsa_trips')
        .select('driver_id, arrive_time, depart_time')
        .in('driver_id', driverIds)
        .gte('depart_time', thirtyDaysAgo),
    ]);

    const shifts = (shiftsRes.data ?? []) as { user_id: string; start_time: string; end_time: string; date?: string; }[];
    const trips  = (tripsRes.data ?? []) as { driver_id: string; arrive_time: string; }[];

    if (shifts.length < 3) {
      setHistoryData(prev => ({ ...prev, [driverName]: null }));
      setHistoryLoading(null);
      return;
    }

    const lastArriveByDate = new Map<string, string>();
    for (const t of trips) {
      const date = t.arrive_time.slice(0, 10);
      if (!lastArriveByDate.has(date) || t.arrive_time > lastArriveByDate.get(date)!) {
        lastArriveByDate.set(date, t.arrive_time);
      }
    }

    const recent: HistoryRow[] = shifts
      .map(s => {
        const date = s.date ?? s.start_time.slice(0, 10);
        const gap  = calcGap(s.end_time, lastArriveByDate.get(date)) ?? 0;
        return { date, gap, cleans: 0 };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
      .map(r => ({
        ...r,
        date: new Date(r.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      }));

    const shiftsWithGap20   = recent.filter(r => r.gap >= 20).length;
    const avgGapMinutes     = recent.length > 0
      ? Math.round(recent.reduce((s, r) => s + r.gap, 0) / recent.length)
      : 0;

    setHistoryData(prev => ({
      ...prev,
      [driverName]: {
        avgGapMinutes,
        totalShifts:      shifts.length,
        shiftsWithGap20,
        shiftsWithCleans: 0,
        correlation:      0,
        recent,
      },
    }));
    setHistoryLoading(null);
  }

  function toggleExpand(name: string, userId?: string) {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!isDemo && userId) loadHistory(name, userId);
  }

  // Demo data
  const demoDrivers  = DEMO_DRIVER_COVERAGE.drivers;
  const demoCleansAtClose = DEMO_DRIVER_COVERAGE.cleansAtClose;

  // Live data
  const todayLog       = washbayLogs.find(l => l.date === localDateStr(0));
  const liveCleansAtClose = todayLog?.carsRemaining ?? null;

  const cleansAtClose = isDemo ? demoCleansAtClose : liveCleansAtClose;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
      <SectionHeader title="Driver Coverage · End-of-Shift" />

      {loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Loading…</p>
      )}

      {!loading && (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100 dark:border-gray-800">
            <span>Driver</span>
            <span className="w-20 text-center">Shift</span>
            <span className="w-16 text-center">Last Run</span>
            <span className="w-10 text-center">Gap</span>
            <span className="w-12 text-center">Cleans</span>
          </div>

          {/* Driver rows */}
          {isDemo ? demoDrivers.map(d => {
            const isExpanded = expanded === d.name;
            const bg = rowBg(d.gapMinutes, d.cleans);
            return (
              <div key={d.name}>
                <button
                  type="button"
                  onClick={() => toggleExpand(d.name)}
                  className={`w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${bg}`}
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{d.name}</span>
                  <span className="w-20 text-center text-xs text-gray-500 dark:text-gray-400">{d.shift}</span>
                  <span className="w-16 text-center text-xs text-gray-600 dark:text-gray-400">{d.lastRun}</span>
                  <span className={`w-10 text-center text-xs tabular-nums ${gapCls(d.gapMinutes, d.cleans)}`}>
                    {d.gapMinutes}m
                  </span>
                  <span className="w-12 text-center text-xs tabular-nums text-gray-700 dark:text-gray-300">
                    {d.cleans != null ? d.cleans : '—'}
                  </span>
                </button>
                {isExpanded && (
                  <HistoryPanel
                    name={d.name}
                    data={DEMO_DRIVER_COVERAGE.history[d.name] ?? null}
                  />
                )}
              </div>
            );
          }) : liveRows.map(d => {
            const gap = calcGap(d.shiftEnd, d.lastArrive);
            const bg  = rowBg(gap, null);
            const isExpanded = expanded === d.name;
            const isLoadingHistory = historyLoading === d.name;
            return (
              <div key={d.userId}>
                <button
                  type="button"
                  onClick={() => toggleExpand(d.name, d.userId)}
                  className={`w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${bg}`}
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{d.name}</span>
                  <span className="w-20 text-center text-xs text-gray-500 dark:text-gray-400">
                    {fmtShift(d.shiftStart, d.shiftEnd)}
                  </span>
                  <span className="w-16 text-center text-xs text-gray-600 dark:text-gray-400">
                    {fmtRunTime(d.lastArrive)}
                  </span>
                  <span className={`w-10 text-center text-xs tabular-nums ${gapCls(gap, null)}`}>
                    {gap != null ? `${gap}m` : '—'}
                  </span>
                  <span className="w-12 text-center text-xs text-gray-400 dark:text-gray-500">—</span>
                </button>
                {isExpanded && (
                  isLoadingHistory
                    ? <p className="text-xs text-gray-400 dark:text-gray-500 italic ml-4 py-2">Loading…</p>
                    : <HistoryPanel name={d.name} data={historyData[d.name] ?? null} />
                )}
              </div>
            );
          })}

          {!isDemo && liveRows.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-4">
              No drivers on shift today.
            </p>
          )}

          {/* Footer */}
          {cleansAtClose != null && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Cleans at close
              </span>
              <span className={`text-sm font-semibold tabular-nums ${
                cleansAtClose > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-500'
              }`}>
                {cleansAtClose > 0
                  ? `${cleansAtClose} — inherited by morning crew ✓`
                  : '0 — queue clear ✓'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}


