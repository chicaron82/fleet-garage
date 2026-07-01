import { useAuth } from '../../context/AuthContext';
import { useSchedule, toISO } from '../../context/ScheduleContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useFleetBalanceContext } from '../../context/FleetBalanceContext';
import { localDateStr } from '../../hooks/useFleetBalance';
import { businessDateOf } from '../../lib/shiftDay';
import { ModuleHeader } from '../shared/ModuleHeader';
import { FleetBalanceEntryForm } from '../vehicle';
import { isFullDayShift } from '../../types';
import type { Screen, ShiftType } from '../../types';

// ── Pass 1 note ──────────────────────────────────────────────────────────────
// The "My Day" cockpit: Aaron's at-a-glance landing. It ASSEMBLES already-tested
// pieces (FleetBalanceEntryForm, schedule/hold/washbay context) rather than
// reinventing them — leads with his shift, then his real first-action ritual
// (log the fleet balance if it's loggable, else the afternoon check-in), then a
// throughput glance and what-needs-attention. Pass 2 extracts the derivations to
// a tested `lib/myDay.ts` + `useMyDay` hook and dedupes the throughput readouts
// against useSidebar (which is too heavy to call twice — it fires notifications
// and pref-sync). For now the numbers come from the lightweight sources.

// ── Style helpers ────────────────────────────────────────────────────────────

const SHIFT_LABEL: Record<ShiftType, string> = {
  opening: 'Opening', mid: 'Mid', closing: 'Closing',
  'day-off': 'Day off', pto: 'PTO', sick: 'Sick',
};

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// DB times come back as 'HH:MM:SS' — trim the seconds for display.
function fmtTime(t?: string): string {
  return t ? t.slice(0, 5) : '';
}

function timeRange(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors';

// ── Main component ───────────────────────────────────────────────────────────

export function MyDayView({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { user } = useAuth();
  const { shifts } = useSchedule();
  const { staleHolds } = useVehicleHoldContext();
  const { latestHandoff } = useWashbayContext();
  const { upsertEntry, getTodayEntry, getProjection } = useFleetBalanceContext();

  const now = new Date();
  const todayISO = toISO(now);
  const todayLabel = now.toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const myShift = shifts.find(s => s.userId === user!.id && s.date === todayISO);
  const working = !!myShift && !isFullDayShift(myShift.shiftType);
  const isMid = myShift?.shiftType === 'mid';

  // Who else is on today (working shifts only), soonest start first.
  const teamOn = shifts
    .filter(s => s.date === todayISO && s.userId !== user!.id && !isFullDayShift(s.shiftType))
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  const todayEntry = getTodayEntry();
  const balanceLogged = !!todayEntry;

  // Throughput — lightweight sources only (see pass-1 note). Cars cleaned comes
  // from today's handoff; the fleet OUT/IN from the logged entry or projection.
  const handoffToday = latestHandoff && businessDateOf(latestHandoff.loggedAt) === localDateStr(0);
  const carsThisShift = handoffToday ? latestHandoff!.fullPages * 19 + latestHandoff!.lastPageEntries : null;
  const projection = getProjection();
  const out = todayEntry?.outCount ?? projection?.avgOut ?? null;
  const inc = todayEntry?.inCount ?? projection?.avgIn ?? null;

  const firstName = user!.name.split(' ')[0];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      <ModuleHeader title="My Day" subtitle={`${greeting(now.getHours())}, ${firstName} · ${todayLabel}`} />

      {/* ── Your shift today ─────────────────────────────────────────────── */}
      <section className={`${CARD} px-4 py-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Your shift</p>
            {myShift ? (
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {SHIFT_LABEL[myShift.shiftType]}
                {timeRange(myShift.startTime, myShift.endTime) && (
                  <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                    {timeRange(myShift.startTime, myShift.endTime)}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Not scheduled today</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'schedule' })}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer shrink-0"
          >
            Schedule →
          </button>
        </div>

        {working && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2 mb-1">
              On with you today · {teamOn.length}
            </p>
            {teamOn.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nobody else scheduled.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {teamOn.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300">
                    {s.user.name.split(' ')[0]}
                    <span className="text-gray-400 dark:text-gray-500 tabular-nums">{fmtTime(s.startTime)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── First action — the ritual: fleet balance, else check-in ──────── */}
      {working && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {balanceLogged ? "Today's fleet balance" : 'First up — log the fleet balance'}
            </h2>
            {balanceLogged && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Logged</span>
            )}
          </div>

          <FleetBalanceEntryForm
            onSubmit={(o, i) => upsertEntry(localDateStr(), o, i, user!.id)}
            todayEntry={todayEntry}
            projection={projection}
          />

          <button
            type="button"
            onClick={() => onNavigate({ name: 'my-shift' })}
            className="w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer"
          >
            {balanceLogged ? 'Next: ' : 'Not available yet? '}
            {isMid ? 'Log mid-shift check-in' : 'Log afternoon check-in'} →
          </button>
        </section>
      )}

      {/* ── Throughput glance ────────────────────────────────────────────── */}
      {working && (
        <section className={`${CARD} px-4 py-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Throughput</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{carsThisShift ?? '—'}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">cars cleaned<br />this shift</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{out ?? '—'}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                out{!balanceLogged && out != null ? ' (est)' : ''}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{inc ?? '—'}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                in{!balanceLogged && inc != null ? ' (est)' : ''}
              </p>
            </div>
          </div>
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
          {staleHolds.length === 0 ? (
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">All clear</p>
          ) : (
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {staleHolds.length} vehicle{staleHolds.length === 1 ? '' : 's'} held too long
            </p>
          )}
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-sm shrink-0">Holds →</span>
      </button>

    </div>
  );
}
