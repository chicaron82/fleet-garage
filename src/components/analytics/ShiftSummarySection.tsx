import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import { localDateStr } from '../../hooks/useFleetBalance';
import { isManagement } from '../../lib/analytics';

function fmtMinutes(mins: number): string {
  if (mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface LiveSummary {
  offStandardMinutes: number;
  offStandardBreakdown: Record<string, number>;
  tripCount: number;
  tripMinutes: number;
  holdsFlagged: number;
  firstActivityAt: string | null;
}

interface SavedSummary {
  id: string;
  userId: string;
  userName: string;
  date: string;
  savedAt: string;
  offStandardMinutes: number;
  offStandardBreakdown: Record<string, number> | null;
  tripCount: number;
  tripMinutes: number;
  holdsFlagged: number;
  firstActivityAt: string | null;
}

function mapSaved(row: Record<string, unknown>): SavedSummary {
  return {
    id:                    row.id as string,
    userId:                row.user_id as string,
    userName:              row.user_name as string,
    date:                  row.date as string,
    savedAt:               row.saved_at as string,
    offStandardMinutes:    row.off_standard_minutes as number,
    offStandardBreakdown:  row.off_standard_breakdown as Record<string, number> | null,
    tripCount:             row.trip_count as number,
    tripMinutes:           row.trip_minutes as number,
    holdsFlagged:          row.holds_flagged as number,
    firstActivityAt:       row.first_activity_at as string | null,
  };
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {sub}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0">{value}</p>
    </div>
  );
}

function HistoryCard({ s }: { s: SavedSummary }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtDate(s.date)}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Saved {fmtTime(s.savedAt)}</p>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>⏱ {fmtMinutes(s.offStandardMinutes)}</span>
        {s.tripCount > 0 && <span>🚗 {s.tripCount} trip{s.tripCount !== 1 ? 's' : ''} · {fmtMinutes(s.tripMinutes)}</span>}
        {s.holdsFlagged > 0 && <span>🚨 {s.holdsFlagged} hold{s.holdsFlagged !== 1 ? 's' : ''}</span>}
      </div>
    </div>
  );
}

export function ShiftSummarySection({ activeBranch, onViewDateChange }: { activeBranch: string; onViewDateChange?: (date: string) => void }) {
  const { user } = useAuth();
  const [live, setLive]           = useState<LiveSummary | null>(null);
  const [history, setHistory]     = useState<SavedSummary[]>([]);
  const [team, setTeam]           = useState<SavedSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savedForDate, setSavedForDate] = useState(false);

  const todayISO     = localDateStr(0);
  const yesterdayISO = localDateStr(-1);
  const [viewDate, setViewDate] = useState(todayISO);
  const isViewingYesterday = viewDate === yesterdayISO;

  const branchId = activeBranch === 'ALL' ? (user?.branchId ?? 'YWG') : activeBranch;

  useEffect(() => {
    if (!user) return;
    loadData(viewDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, branchId, viewDate]);

  async function loadData(date: string) {
    if (!user) return;
    setLoading(true);

    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd   = new Date(date + 'T00:00:00');
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayStartISO = dayStart.toISOString();
    const dayEndISO   = dayEnd.toISOString();

    const [osResult, tripsResult, holdsResult, histResult] = await Promise.all([
      supabase.from('off_standard_entries')
        .select('start_time, minutes, reason')
        .eq('user_id', user.id)
        .eq('date', date)
        .not('minutes', 'is', null),
      supabase.from('vsa_trips')
        .select('depart_time, arrive_time')
        .eq('driver_id', user.id)
        .gte('depart_time', dayStartISO)
        .lt('depart_time', dayEndISO)
        .not('arrive_time', 'is', null),
      supabase.from('holds')
        .select('flagged_at')
        .eq('flagged_by_id', user.id)
        .gte('flagged_at', dayStartISO)
        .lt('flagged_at', dayEndISO),
      supabase.from('shift_summaries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', localDateStr(-6))
        .order('date', { ascending: false }),
    ]);

    const osEntries = osResult.data ?? [];
    const offStandardMinutes = osEntries.reduce((s, r) => s + ((r.minutes as number) ?? 0), 0);
    const offStandardBreakdown: Record<string, number> = {};
    osEntries.forEach(r => {
      const reason = r.reason as string;
      offStandardBreakdown[reason] = (offStandardBreakdown[reason] ?? 0) + ((r.minutes as number) ?? 0);
    });

    const trips = tripsResult.data ?? [];
    const tripCount = trips.length;
    const tripMinutes = trips.reduce((s, r) => {
      const mins = Math.round(
        (new Date(r.arrive_time as string).getTime() - new Date(r.depart_time as string).getTime()) / 60000
      );
      return s + Math.max(0, mins);
    }, 0);

    const holdsFlagged = (holdsResult.data ?? []).length;

    const allTimes = [
      ...osEntries.map(r => r.start_time as string),
      ...trips.map(r => r.depart_time as string),
      ...(holdsResult.data ?? []).map(r => r.flagged_at as string),
    ].filter(Boolean).sort();

    setLive({
      offStandardMinutes,
      offStandardBreakdown,
      tripCount,
      tripMinutes,
      holdsFlagged,
      firstActivityAt: allTimes[0] ?? null,
    });

    const saved = (histResult.data ?? []).map(r => mapSaved(r as unknown as Record<string, unknown>));
    setHistory(saved);
    setSavedForDate(saved.some(s => s.date === date));

    if (isManagement(user.role)) {
      const { data: teamData } = await supabase.from('shift_summaries')
        .select('*')
        .eq('branch_id', branchId)
        .eq('date', date)
        .order('saved_at', { ascending: false });
      setTeam((teamData ?? []).map(r => mapSaved(r as unknown as Record<string, unknown>)));
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!user || !live) return;
    hapticMedium();
    setSaving(true);

    const { error } = await writeWithRefresh(() =>
      supabase.from('shift_summaries').upsert({
        user_id:                user.id,
        user_name:              user.name,
        branch_id:              user.branchId,
        date:                   viewDate,
        first_activity_at:      live.firstActivityAt,
        saved_at:               new Date().toISOString(),
        off_standard_minutes:   live.offStandardMinutes,
        off_standard_breakdown: Object.keys(live.offStandardBreakdown).length > 0 ? live.offStandardBreakdown : null,
        trip_count:             live.tripCount,
        trip_minutes:           live.tripMinutes,
        holds_flagged:          live.holdsFlagged,
      }, { onConflict: 'user_id,date' })
    );

    if (!error) {
      setSavedForDate(true);
      const { data } = await supabase.from('shift_summaries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', localDateStr(-6))
        .order('date', { ascending: false });
      setHistory((data ?? []).map(r => mapSaved(r as unknown as Record<string, unknown>)));
    }

    setSaving(false);
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
        Loading your shift…
      </div>
    );
  }

  const hasActivity = live && (live.offStandardMinutes > 0 || live.tripCount > 0 || live.holdsFlagged > 0);
  const topReasons  = live
    ? Object.entries(live.offStandardBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];
  const extraReasons = live ? Math.max(0, Object.keys(live.offStandardBreakdown).length - 3) : 0;

  return (
    <div className="space-y-4">

      {/* Day toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setViewDate(todayISO); onViewDateChange?.(todayISO); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            !isViewingYesterday
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => { setViewDate(yesterdayISO); onViewDateChange?.(yesterdayISO); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            isViewingYesterday
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Yesterday
        </button>
      </div>

      {/* Live card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              {isViewingYesterday ? 'My Shift · Yesterday' : 'My Shift Today'}
            </p>
            {live?.firstActivityAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Active since {fmtTime(live.firstActivityAt)}</p>
            )}
          </div>
          {savedForDate && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 mt-0.5">
              ✓ Saved
            </span>
          )}
        </div>

        {!hasActivity ? (
          <p className="px-4 py-8 text-sm text-gray-400 dark:text-gray-500 italic text-center">
            No activity logged today yet.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {live!.offStandardMinutes > 0 && (
              <SummaryRow
                label="Off-Standard"
                value={fmtMinutes(live!.offStandardMinutes)}
                sub={topReasons.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {topReasons.map(([reason, mins]) => (
                      <span key={reason} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                        {reason} · {fmtMinutes(mins)}
                      </span>
                    ))}
                    {extraReasons > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                        +{extraReasons} more
                      </span>
                    )}
                  </div>
                ) : undefined}
              />
            )}

            {live!.tripCount > 0 && (
              <SummaryRow
                label="VSA Trips"
                value={fmtMinutes(live!.tripMinutes)}
                sub={<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{live!.tripCount} run{live!.tripCount !== 1 ? 's' : ''}</p>}
              />
            )}

            {live!.holdsFlagged > 0 && (
              <SummaryRow label="Holds Flagged" value={String(live!.holdsFlagged)} />
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasActivity}
            className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300"
          >
            {saving ? 'Saving…' : savedForDate ? 'Update Summary' : isViewingYesterday ? 'Save Yesterday\'s Summary' : 'Save Summary'}
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <p className="px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">
            Recent Shifts
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map(s => <HistoryCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* Team Today — management only */}
      {isManagement(user.role) && team.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <p className="px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">
            Team Today
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {team.map(s => (
              <div key={s.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.userName}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Saved {fmtTime(s.savedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>⏱ {fmtMinutes(s.offStandardMinutes)}</span>
                  {s.tripCount > 0 && <span>🚗 {s.tripCount} trip{s.tripCount !== 1 ? 's' : ''} · {fmtMinutes(s.tripMinutes)}</span>}
                  {s.holdsFlagged > 0 && <span>🚨 {s.holdsFlagged} hold{s.holdsFlagged !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
