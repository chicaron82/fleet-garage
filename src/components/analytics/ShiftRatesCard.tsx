import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase } from '../../lib/supabase';
import { localDateStr } from '../../hooks/useFleetBalance';
import { businessDateOf, shiftDayStartISO } from '../../lib/shiftDay';
import {
  buildShiftPartition,
  deriveShiftWindow,
  deriveUserShift,
  resolveShiftRates,
  creditFlipsToRate,
  shiftRateWarning,
  reducesDenominator,
} from '../../lib/shift-metrics';
import { useAirportFlip } from '../../hooks/useAirportFlip';
import { sentToFleet } from '../../lib/washbay-throughput';
import { fmtHours } from '../../lib/ot';
import { fmtMinutes } from './shiftSummaryUtils';

const STANDARD_RATE = 3.0;

export function ShiftRatesCard() {
  const { user } = useAuth();
  const { getTodayWashbayLog, handoffNotes, getTodayCheckpoint, getMidArrival, getMidDeparture } = useWashbayContext();
  const { shifts } = useSchedule();
  const flipCount = useAirportFlip().rows.length;
  const [entries, setEntries] = useState<{ startTime: string; minutes: number; presetReason?: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('off_standard_entries')
      .select('start_time, minutes, preset_reason')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .gte('start_time', shiftDayStartISO(localDateStr(0)))
      .or('is_backdated.is.null,is_backdated.eq.false,edit_status.eq.approved')
      .then(({ data }) => {
        if (data) setEntries(
          (data as { start_time: string; minutes: number; preset_reason: string | null }[]).map(r => ({
            startTime:    r.start_time,
            minutes:      r.minutes,
            presetReason: r.preset_reason,
          }))
        );
      });
  }, [user]);

  if (!user) return null;

  const washbayLog    = getTodayWashbayLog();
  const fullDayCleaned = washbayLog ? sentToFleet(washbayLog) : null;
  const todayHandoff  = handoffNotes.find(n =>
    businessDateOf(n.loggedAt) === localDateStr(0)
  ) ?? null;

  const offTotal      = entries.filter(reducesDenominator).reduce((s, e) => s + e.minutes, 0);

  const myShift       = deriveUserShift(shifts, user.id);
  const window        = deriveShiftWindow(myShift?.shiftType) ?? 'morning';
  const checkpoint    = getTodayCheckpoint();
  const midArrival    = getMidArrival();
  const midDeparture  = getMidDeparture();
  const partition     = buildShiftPartition({ handoff: todayHandoff, checkpoint, fullDayCleaned, offStandardEntries: entries, midArrival, midDeparture });
  // Shared seam: window from actual→planned→default, OTH scoped to it, then rated.
  const { snapshot: mySnapshot, yourEffort } = resolveShiftRates({
    partition, shift: myShift, date: localDateStr(0), offStandardEntries: entries,
  });
  const myCarsCleaned = mySnapshot.cleaned;
  // Live-only flip credit (Aaron 2026-07-17): a flipped return is a rent-ready car — the same
  // output as a washbay clean, minus the ~27min transit. The flip TIME already sits in the rate
  // denominator (airport_flip is non-reducing), so flipping was silently DRAGGING the rate down —
  // uncredited output against charged time. Crediting the flips into the numerator corrects that.
  // Read live from the ephemeral session (this shift, this device) — NOT baked into the durable
  // snapshot/PDF (flips don't persist), so resolveShiftRates stays flip-free.
  const flipsCredited = myCarsCleaned != null ? flipCount : 0;
  const credited = creditFlipsToRate(mySnapshot, flipCount);
  const dispBaseline = credited.baseline;
  const dispEffort = credited.yourEffort;
  const hasShiftData  = yourEffort != null;
  const activeMinutes = Math.max(0, mySnapshot.hours * 60 - offTotal);
  const rateWarning   = shiftRateWarning(mySnapshot);

  const rateColor = !hasShiftData ? 'text-gray-400 dark:text-gray-500'
    : dispEffort! >= STANDARD_RATE ? 'text-green-600 dark:text-green-400'
    : dispEffort! >= 2.5 ? 'text-amber-500'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Shift Rates</p>
      </div>
      <div className="p-4 space-y-4">

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Shift hours</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{fmtHours(mySnapshot.hours)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Off-standard (rate-affecting)</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{fmtMinutes(offTotal)}</span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">
            Counts against rate — excludes EDV &amp; cars sent to fleet. May read below the My&nbsp;Shift total.
          </p>
          <div className="flex justify-between text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
            <span>Active cleaning</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtMinutes(activeMinutes)}</span>
          </div>
        </div>

        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Cars cleaned (your shift)</span>
          {myCarsCleaned != null ? (
            <span className="font-semibold text-gray-900 dark:text-gray-100">{myCarsCleaned}</span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic">
              {window === 'morning' ? 'Submit handoff to see' : window === 'mid' ? 'Submit mid shift checkpoints to see' : 'Submit closing duties to see'}
            </span>
          )}
        </div>

        {/* Live flip credit — shown as its own line so the rate is never a mystery number. */}
        {flipsCredited > 0 && (
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 -mt-2">
            <span>✈️ Airport flips <span className="text-[10px] text-gray-400 dark:text-gray-500">rent-ready · credited this shift</span></span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">+{flipsCredited}</span>
          </div>
        )}

        {hasShiftData && (
          <div className={`rounded-lg px-4 py-3 border ${
            dispEffort! >= STANDARD_RATE
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
              : dispEffort! >= 2.5
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
          }`}>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500 dark:text-gray-400">Standard rate</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{STANDARD_RATE.toFixed(1)} / hr</span>
            </div>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Shift baseline ({fmtHours(mySnapshot.hours)} window)</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{dispBaseline!.toFixed(1)} / hr</span>
            </div>
            <div className="flex justify-between items-baseline mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">Your effort</span>
              <span className={`text-lg font-bold ${rateColor}`}>{dispEffort!.toFixed(1)} / hr</span>
            </div>
            {offTotal > 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Adjusted for {fmtMinutes(offTotal)} off-standard
              </p>
            )}
          </div>
        )}

        {rateWarning && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <span aria-hidden="true" className="text-amber-500 text-sm leading-tight">⚠</span>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">{rateWarning}</p>
          </div>
        )}

      </div>
    </div>
  );
}
