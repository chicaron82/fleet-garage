import { useMyDay } from '../../hooks/useMyDay';
import { ModuleHeader } from '../shared/ModuleHeader';
import { FleetBalanceEntryForm } from '../vehicle';
import { OpeningLotCard } from './OpeningLotCard';
import { nextAttendance } from '../../lib/myDay';
import type { Screen } from '../../types';

// The "My Day" cockpit: Aaron's at-a-glance landing. A thin renderer over
// useMyDay (which assembles the schedule / hold / washbay / fleet-balance
// context and runs the pure lib/myDay derivations). Leads with today's shift +
// who's on, then the first-action ritual (log the fleet balance if it's loggable,
// else the afternoon check-in), a washbay throughput glance, and what needs
// attention. Assembles already-tested pieces (FleetBalanceEntryForm, etc.) rather
// than reinventing them.

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors';

export function MyDayView({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const day = useMyDay();

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      <ModuleHeader title="My Day" subtitle={`${day.greeting}, ${day.firstName} · ${day.dateLabel}`} />

      {/* ── Your shift today ─────────────────────────────────────────────── */}
      <section className={`${CARD} px-4 py-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Your shift</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {day.shiftLabel ?? 'Not scheduled today'}
              {day.shiftTime && (
                <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">{day.shiftTime}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'schedule' })}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer shrink-0"
          >
            Schedule →
          </button>
        </div>

        {day.working && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2 mb-0.5">
              On with you today · {day.team.length}
            </p>
            {day.team.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nobody else scheduled.</p>
            ) : (
              <>
                <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">Tap a name: scheduled → present → no-show.</p>
                <div className="flex flex-wrap gap-1.5">
                  {day.team.map(mate => {
                    const att = mate.attendance;
                    const tone = att === 'present'
                      ? 'bg-green-100 text-green-800 ring-1 ring-green-300 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800'
                      : att === 'absent'
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                    return (
                      <button
                        key={mate.id}
                        type="button"
                        onClick={() => day.setShiftAttendance(mate.id, nextAttendance(att) ?? null)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition cursor-pointer ${tone}`}
                      >
                        {att === 'present' && <span aria-hidden className="font-bold">✓</span>}
                        {att === 'absent' && <span aria-hidden className="font-bold">✗</span>}
                        <span className={att === 'absent' ? 'line-through' : ''}>{mate.firstName}</span>
                        <span className="tabular-nums opacity-60">{mate.start}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── First action — the ritual: fleet balance, else check-in ──────── */}
      {day.working && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {day.balanceLogged ? "Today's fleet balance" : 'First up — log the fleet balance'}
            </h2>
            {day.balanceLogged && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Logged</span>
            )}
          </div>

          <FleetBalanceEntryForm
            onSubmit={day.logBalance}
            todayEntry={day.todayEntry}
            projection={day.projection}
          />

          <button
            type="button"
            onClick={() => onNavigate({ name: 'my-shift' })}
            className="w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer"
          >
            {day.balanceLogged ? 'Next: ' : 'Not available yet? '}
            {day.isMid ? 'Log mid-shift check-in' : 'Log afternoon check-in'} →
          </button>
        </section>
      )}

      {/* ── What you walked into (opening shift) ─────────────────────────── */}
      {day.working && day.myShift?.shiftType === 'opening' && <OpeningLotCard />}

      {/* ── Washbay throughput glance ────────────────────────────────────── */}
      {day.working && (
        <section className={`${CARD} px-4 py-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Throughput · Washbay</p>
          {day.carsCleanedThisShift == null ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No shift handoff logged yet.</p>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{day.carsCleanedThisShift}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                cars cleaned this shift{day.handoffToday ? ` · team of ${day.handoffToday.teamSize}` : ''}
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Needs attention ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onNavigate({ name: 'dashboard' })}
        className={`${CARD} w-full px-4 py-4 flex items-center justify-between text-left hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Needs attention</p>
          {day.staleCount === 0 ? (
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">All clear</p>
          ) : (
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {day.staleCount} vehicle{day.staleCount === 1 ? '' : 's'} held too long
            </p>
          )}
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-sm shrink-0">Holds →</span>
      </button>

    </div>
  );
}
