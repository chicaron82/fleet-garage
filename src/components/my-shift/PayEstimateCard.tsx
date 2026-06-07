import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toISO } from '../../context/ScheduleContext';
import { supabase } from '../../lib/supabase';
import { rowToShiftBase } from '../../lib/rowToShift';
import { calcPayEstimate, getPayPeriod, PAY_CONFIG, type PayEstimate } from '../../lib/payEstimate';
import { fmtHours } from '../../lib/ot';
import type { Shift } from '../../types';

function fmt(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function offsetDay(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface PeriodBlockProps {
  est: PayEstimate;
  label: string;
  nearFinal?: boolean;
  scheduleFloor?: boolean;
}

function PeriodBlock({ est, label, nearFinal, scheduleFloor }: PeriodBlockProps) {
  const totalDays = est.daysLogged + est.daysProjected;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{label}</span>
          {nearFinal && <span className="text-gray-400 dark:text-gray-500">· near-final</span>}
          {scheduleFloor && <span className="text-gray-400 dark:text-gray-500">· schedule floor</span>}
        </div>
        <span className="text-gray-500 dark:text-gray-400">
          {fmtDate(est.periodStart)} – {fmtDate(est.periodEnd)}
        </span>
      </div>

      {totalDays > 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {est.daysLogged > 0 && `${est.daysLogged} logged`}
          {est.daysLogged > 0 && est.daysProjected > 0 && ' · '}
          {est.daysProjected > 0 && `${est.daysProjected} projected`}
        </p>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hours</p>
        <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
          <span>Regular <span className="text-gray-400 dark:text-gray-500 text-xs">{fmtHours(est.regularHours)} × ${PAY_CONFIG.regularRate.toFixed(2)}</span></span>
          <span className="tabular-nums">{fmt(est.regularHours * PAY_CONFIG.regularRate)}</span>
        </div>
        {est.otHours > 0 && (
          <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
            <span>OT <span className="text-xs">{fmtHours(est.otHours)} × ${PAY_CONFIG.otRate.toFixed(2)}</span></span>
            <span className="tabular-nums">{fmt(est.otHours * PAY_CONFIG.otRate)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Gross</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmt(est.gross)}</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Deductions</p>
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>CPP</span><span className="tabular-nums">−{fmt(est.cpp)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>EI</span><span className="tabular-nums">−{fmt(est.ei)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Income Tax</span><span className="tabular-nums">−{fmt(est.tax)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-2">
        <span className="font-bold text-gray-900 dark:text-gray-100">Est. Net</span>
        <span className="text-xl font-black tabular-nums text-green-600 dark:text-green-400">{fmt(est.net)}</span>
      </div>

      {scheduleFloor && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          Schedule floor — no OT projected.
        </p>
      )}
      {!scheduleFloor && est.daysProjected > 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {est.daysProjected} day{est.daysProjected !== 1 ? 's' : ''} not yet logged — using scheduled hours. OT not projected.
        </p>
      )}
    </div>
  );
}

export function PayEstimateCard() {
  const { user } = useAuth();
  const [open, setOpen]     = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const today = toISO(new Date());

  // Compute all three periods from today
  const { prevPeriod, nextPeriod } = useMemo(() => {
    const curr = getPayPeriod(today);
    return {
      prevPeriod: getPayPeriod(offsetDay(curr.start, -1)),
      nextPeriod: getPayPeriod(offsetDay(curr.end, 1)),
    };
  }, [today]);

  // One wide fetch spanning all three periods; slice per-period in memory
  useEffect(() => {
    if (user?.employeeId !== PAY_CONFIG.employeeId) return;
    supabase
      .from('shifts')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', prevPeriod.start)
      .lte('date', nextPeriod.end)
      .then(({ data }) => {
        if (data) setShifts(data.map(rowToShiftBase));
      });
  }, [user, prevPeriod.start, nextPeriod.end]);

  const [prevEst, currEst, nextEst] = useMemo(() => [
    calcPayEstimate(shifts, prevPeriod.start),
    calcPayEstimate(shifts, today),
    calcPayEstimate(shifts, nextPeriod.start),
  ], [shifts, today, prevPeriod.start, nextPeriod.start]);

  if (user?.employeeId !== PAY_CONFIG.employeeId) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pay Estimate</span>
          {!open && currEst.gross > 0 && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">{fmt(currEst.net)} est. net</span>
          )}
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="px-4 py-4">
            <PeriodBlock est={prevEst} label="Previous" nearFinal />
          </div>
          <div className="px-4 py-4">
            <PeriodBlock est={currEst} label="Current" />
          </div>
          <div className="px-4 py-4">
            <PeriodBlock est={nextEst} label="Next" scheduleFloor />
          </div>
        </div>
      )}
    </div>
  );
}
