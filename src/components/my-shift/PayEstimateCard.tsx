import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { toISO } from '../../context/ScheduleContext';
import { calcPayEstimate, PAY_CONFIG } from '../../lib/payEstimate';
import { fmtHours } from '../../lib/ot';

function fmt(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export function PayEstimateCard() {
  const { user }  = useAuth();
  const { shifts } = useSchedule();
  const [open, setOpen] = useState(false);

  const today    = toISO(new Date());
  const myShifts = useMemo(
    () => shifts.filter(s => s.userId === user?.id),
    [shifts, user]
  );
  const est = useMemo(() => calcPayEstimate(myShifts, today), [myShifts, today]);

  if (user?.employeeId !== PAY_CONFIG.employeeId) return null;

  const totalDays = est.daysLogged + est.daysProjected;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pay Estimate</span>
          {!open && est.gross > 0 && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">{fmt(est.net)} est. net</span>
          )}
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-4">

          {/* Period header */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">{fmtDate(est.periodStart)} – {fmtDate(est.periodEnd)}</span>
            {totalDays > 0 && (
              <span>
                {est.daysLogged} logged
                {est.daysProjected > 0 && ` · ${est.daysProjected} projected`}
              </span>
            )}
          </div>

          {/* Hours */}
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

          {/* Gross */}
          <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Gross</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmt(est.gross)}</span>
          </div>

          {/* Deductions */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Deductions</p>
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>CPP</span>
              <span className="tabular-nums">−{fmt(est.cpp)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>EI</span>
              <span className="tabular-nums">−{fmt(est.ei)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Income Tax</span>
              <span className="tabular-nums">−{fmt(est.tax)}</span>
            </div>
          </div>

          {/* Net */}
          <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-3">
            <span className="font-bold text-gray-900 dark:text-gray-100">Est. Net</span>
            <span className="text-xl font-black tabular-nums text-green-600 dark:text-green-400">{fmt(est.net)}</span>
          </div>

          {est.daysProjected > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {est.daysProjected} day{est.daysProjected !== 1 ? 's' : ''} not yet logged — using scheduled hours. OT not projected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
