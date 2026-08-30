import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import { localDateStr } from '../../hooks/useFleetBalance';
import { shiftDayWindow } from '../../lib/shiftDay';
import { isManagement } from '../../lib/analytics';
import {
  SummaryRow, ShiftSparkline, HistoryCard, TeamTodayCard,
} from './AnalyticsComponents';
import { ShiftExportActionSheet } from '../my-shift/ShiftExportActionSheet';
import { fmtMinutes, fmtTime, type SavedSummary, type Pump2Drift, mapSaved, decomposeOffStandard } from './shiftSummaryUtils';

interface LiveSummary {
  offStandardMinutes: number;   // total (persisted) — equals nonAirport + airport + flipping
  nonAirportMinutes: number;    // manually-logged off-standard (the card's "Off-Standard" row)
  airportMinutes: number;       // auto-logged airport time (the card's "VSA Trips" row)
  flippingMinutes: number;      // manual "Flipping Returns" (airport_flip) — its own airport line
  offStandardBreakdown: Record<string, number>;  // non-airport reasons only
  tripCount: number;
  tripMinutes: number;          // from vsa_trips — still persisted to the snapshot
  holdsFlagged: number;
  firstActivityAt: string | null;
  pump2Drift: Pump2Drift | null;
}

export function ShiftSummarySection({ activeBranch }: { activeBranch: string }) {
  const { user } = useAuth();
  const [live, setLive]           = useState<LiveSummary | null>(null);
  const [history, setHistory]     = useState<SavedSummary[]>([]);
  const [team, setTeam]           = useState<SavedSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savedForDate, setSavedForDate] = useState(false);

  const todayISO = localDateStr(0);
  const [exportDate, setExportDate] = useState<string | null>(null);

  const branchId = activeBranch === 'ALL' ? (user?.branchId ?? 'YWG') : activeBranch;

  useEffect(() => {
    if (!user) return;
    loadData(todayISO);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, branchId]);

  async function loadData(date: string) {
    if (!user) return;
    setLoading(true);
    const { startISO: dayStartISO, endISO: dayEndISO } = shiftDayWindow(date);

    const [osResult, tripsResult, holdsResult, histResult] = await Promise.all([
      supabase.from('off_standard_entries')
        .select('start_time, minutes, reason, auto_from_trip, preset_reason')
        .eq('user_id', user.id)
        .eq('date', date)
        .not('minutes', 'is', null)
        .or('is_backdated.is.null,is_backdated.eq.false,edit_status.eq.approved'),
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
        .gte('date', localDateStr(-30))
        .order('date', { ascending: false })
        .limit(5),
    ]);

    const osEntries = osResult.data ?? [];
    // Decompose off-standard into airport (auto-logged from trips) and non-airport
    // so the card shows airport time once, not double-counted against trip minutes.
    const offStandard = decomposeOffStandard(
      osEntries.map(r => ({
        minutes:      r.minutes as number | null,
        reason:       r.reason as string,
        autoFromTrip: (r.auto_from_trip as boolean) ?? false,
        presetReason: (r.preset_reason as string | null) ?? null,
      })),
    );

    const trips = tripsResult.data ?? [];
    const tripCount = trips.length;
    const tripMinutes = trips.reduce((s, r) => {
      const mins = Math.round(
        (new Date(r.arrive_time as string).getTime() - new Date(r.depart_time as string).getTime()) / 60000
      );
      return s + Math.max(0, mins);
    }, 0);

    const holdsFlagged = (holdsResult.data ?? []).length;

    // Pump 2 is a normal metered pump again (back in service 2026-08-13) — no more
    // locked-tripwire drift to compute. Historical pump2_drift rows still display.
    const pump2Drift: Pump2Drift | null = null;

    const allTimes = [
      ...osEntries.map(r => r.start_time as string),
      ...trips.map(r => r.depart_time as string),
      ...(holdsResult.data ?? []).map(r => r.flagged_at as string),
    ].filter(Boolean).sort();

    setLive({
      offStandardMinutes:   offStandard.total,
      nonAirportMinutes:    offStandard.nonAirport,
      airportMinutes:       offStandard.airport,
      flippingMinutes:      offStandard.flipping,
      offStandardBreakdown: offStandard.breakdown,
      tripCount, tripMinutes, holdsFlagged, firstActivityAt: allTimes[0] ?? null, pump2Drift,
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

  async function doSave(liveData: LiveSummary) {
    if (!user) return;
    setSaving(true);
    const { error } = await writeWithRefresh(() =>
      supabase.from('shift_summaries').upsert({
        user_id:                user.id,
        user_name:              user.name,
        branch_id:              user.branchId,
        date:                   todayISO,
        first_activity_at:      liveData.firstActivityAt,
        saved_at:               new Date().toISOString(),
        off_standard_minutes:   liveData.offStandardMinutes,
        off_standard_breakdown: Object.keys(liveData.offStandardBreakdown).length > 0 ? liveData.offStandardBreakdown : null,
        trip_count:             liveData.tripCount,
        trip_minutes:           liveData.tripMinutes,
        holds_flagged:          liveData.holdsFlagged,
        pump2_drift:            liveData.pump2Drift ?? null,
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

  function handleSave() {
    if (!live) return;
    hapticMedium();
    doSave(live);
  }

  // Auto-save once when today's activity loads for the first time. Fires on
  // mount if there's unsaved activity — covers the "forgot to tap Save" case.
  useEffect(() => {
    if (!live || savedForDate) return;
    const hasAct = live.offStandardMinutes > 0 || live.tripCount > 0 || live.holdsFlagged > 0;
    if (!hasAct) return;
    doSave(live);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

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

      {/* Live card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">My Shift Today</p>
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
            {live!.nonAirportMinutes > 0 && (
              <SummaryRow
                label={live!.airportMinutes > 0 ? 'Off-Standard (non-airport)' : 'Off-Standard'}
                value={fmtMinutes(live!.nonAirportMinutes)}
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

            {(live!.airportMinutes > 0 || live!.tripCount > 0) && (
              <SummaryRow
                label="VSA Trips (airport)"
                value={fmtMinutes(live!.airportMinutes)}
                sub={<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{live!.tripCount} run{live!.tripCount !== 1 ? 's' : ''}</p>}
              />
            )}

            {/* Flipping returns — airport work (not rate-affecting), but not a VSA
                trip either, so it gets its own labelled line rather than inflating
                the trip row or the rate-affecting non-airport pool. */}
            {live!.flippingMinutes > 0 && (
              <SummaryRow
                label="Flipping Returns (airport)"
                value={fmtMinutes(live!.flippingMinutes)}
                sub={<p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">manual turnaround · not rate-affecting</p>}
              />
            )}

            {/* Reconciling subtotal — the scoped rows above add to this (and to the
                off-standard PDF). Shown only when there are ≥2 parts to sum. */}
            {[live!.nonAirportMinutes, live!.airportMinutes, live!.flippingMinutes].filter(m => m > 0).length >= 2 && (
              <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>Total off-standard</span>
                <span className="font-medium">{fmtMinutes(live!.offStandardMinutes)}</span>
              </div>
            )}

            {live!.holdsFlagged > 0 && (
              <SummaryRow label="Units Flagged" value={String(live!.holdsFlagged)} />
            )}
            {live!.pump2Drift && live!.pump2Drift !== 'ok' && (
              <SummaryRow
                label="Pump 2"
                value={live!.pump2Drift === 'used' ? '⚠ Used (meter advanced)' : '⚠ Fault (meter dropped)'}
              />
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasActivity}
            /* ⚠️ YELLOW, not black. A primary action ON THE PAGE wears the app's action colour;
               black is reserved for a commit inside a modal or action sheet (see CLAUDE.md,
               "Button language"). This one sat inline directly under a yellow sibling and read as a
               different kind of control — Aaron, 2026-08-30: *"action buttons in FG are yellow …
               two here are black. breaking the design language"*. */
            className="w-full py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900 cursor-pointer"
          >
            {saving ? 'Saving…' : savedForDate ? 'Update Summary' : 'Save Summary'}
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Recent Shifts
            </p>
            <ShiftSparkline history={history} />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map(s => (
              <HistoryCard key={s.id} s={s} onExportClick={() => setExportDate(s.date)} />
            ))}
          </div>
        </div>
      )}

      {exportDate && (
        <ShiftExportActionSheet date={exportDate} onClose={() => setExportDate(null)} />
      )}

      <TeamTodayCard team={team} />

    </div>
  );
}
