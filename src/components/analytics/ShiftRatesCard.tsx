import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGarage } from '../../context/GarageContext';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase } from '../../lib/supabase';
import { localDateStr } from '../../hooks/useFleetBalance';
import {
  buildShiftPartition,
  computeShiftRates,
  deriveShiftWindow,
  deriveUserShiftType,
  pickShift,
} from '../../lib/shift-metrics';

const SHIFT_HOURS = 8;
const STANDARD_RATE = 3.0;

function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function ShiftRatesCard() {
  const { user } = useAuth();
  const { getTodayWashbayLog, handoffNotes } = useGarage();
  const { shifts } = useSchedule();
  const [entries, setEntries] = useState<{ startTime: string; minutes: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    supabase
      .from('off_standard_entries')
      .select('start_time, minutes')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .gte('start_time', todayStart.toISOString())
      .then(({ data }) => {
        if (data) setEntries(
          (data as { start_time: string; minutes: number }[]).map(r => ({
            startTime: r.start_time,
            minutes:   r.minutes,
          }))
        );
      });
  }, [user]);

  if (!user) return null;

  const washbayLog    = getTodayWashbayLog();
  const fullDayCleaned = washbayLog
    ? Math.max(0, (washbayLog.fullPages * 19 + washbayLog.lastPageEntries) - washbayLog.carsRemaining)
    : null;
  const todayHandoff  = handoffNotes.find(n =>
    new Date(n.loggedAt).toLocaleDateString('en-CA') === localDateStr(0)
  ) ?? null;

  const offTotal      = entries.reduce((s, e) => s + e.minutes, 0);
  const activeMinutes = Math.max(0, SHIFT_HOURS * 60 - offTotal);

  const userShiftType = deriveUserShiftType(shifts, user.id);
  const window        = deriveShiftWindow(userShiftType) ?? 'morning';
  const partition     = buildShiftPartition({ handoff: todayHandoff, fullDayCleaned, offStandardEntries: entries });
  const mySnapshot    = pickShift(partition, window);
  const { baseline: shiftBaseline, yourEffort } = computeShiftRates(mySnapshot);
  const myCarsCleaned = mySnapshot.cleaned;
  const hasShiftData  = yourEffort != null;

  const rateColor = !hasShiftData ? 'text-gray-400 dark:text-gray-500'
    : yourEffort! >= STANDARD_RATE ? 'text-green-600 dark:text-green-400'
    : yourEffort! >= 2.5 ? 'text-amber-500'
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
            <span className="font-medium text-gray-900 dark:text-gray-100">{SHIFT_HOURS}h</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Off-standard total</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{fmtMinutes(offTotal)}</span>
          </div>
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
              {window === 'morning' ? 'Submit handoff to see' : 'Submit closing duties to see'}
            </span>
          )}
        </div>

        {hasShiftData && (
          <div className={`rounded-lg px-4 py-3 border ${
            yourEffort! >= STANDARD_RATE
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
              : yourEffort! >= 2.5
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
          }`}>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500 dark:text-gray-400">Standard rate</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{STANDARD_RATE.toFixed(1)} / hr</span>
            </div>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Shift baseline ({mySnapshot.hours}h window)</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{shiftBaseline!.toFixed(1)} / hr</span>
            </div>
            <div className="flex justify-between items-baseline mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">Your effort</span>
              <span className={`text-lg font-bold ${rateColor}`}>{yourEffort!.toFixed(1)} / hr</span>
            </div>
            {offTotal > 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Adjusted for {fmtMinutes(offTotal)} off-standard
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
