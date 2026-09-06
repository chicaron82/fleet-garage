import { TeamRoster } from './TeamRoster';
import { useOpeningQuickStart } from '../../hooks/useOpeningQuickStart';
import { shouldShowOpeningQuickStart } from '../../lib/openingQuickStart';
import { useMyDay } from '../../hooks/useMyDay';
import { useScanRouter } from '../../context/scanRouter';
import { useActiveSessions } from '../../context/ActiveSessionsContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { FleetBalanceEntryForm } from '../vehicle';
import { OpeningLotCard } from './OpeningLotCard';
import { PlateWatchCard } from './PlateWatchCard';
import { MyTrailCard } from './MyTrailCard';
import { FuelPumpReadings } from '../my-shift/FuelPumpReadings';
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
  const scanRouter = useScanRouter();
  const { signalOpeningDuties, setMovementTab } = useActiveSessions();
  const { logged, dismissed, dismiss: dismissOpeningCard } = useOpeningQuickStart(day.user.id, day.todayISO);
  const showOpeningCard = shouldShowOpeningQuickStart({
    shiftType: day.myShift?.shiftType, working: day.working, logged, dismissed,
  });

  // Punch in → one tap starts the Opening Duties timer, no trip to the Off-Standard tab to
  // hunt the quick-tap. Signal + land him on the running timer; the module still does the work.
  const startOpeningDuties = () => {
    signalOpeningDuties();
    setMovementTab('off-standard');
    onNavigate({ name: 'movement-log' });
  };

  return (
    <div className="py-6 space-y-5">

      <ModuleHeader title="My Day" subtitle={`${day.greeting}, ${day.firstName} · ${day.dateLabel}`} />

      {/* ── Scan a key tag ───────────────────────────────────────────────────
          The cockpit's front door: a tag in hand → FG says what the car is and
          what you can do with it, then routes. (Same overlay as the header icon.) */}
      <button
        type="button"
        onClick={scanRouter.scan}
        className={`${CARD} w-full px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition`}
      >
        <span className="text-xl leading-none">📷</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Scan a key tag</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">Register, flag, log a found item, or start a trip</span>
        </span>
        <span className="text-gray-300 dark:text-gray-600">→</span>
      </button>

      {/* ── Opening quick-start ──────────────────────────────────────────────
          Opening shifts only: the first thing he does after punching in. One tap
          starts the Opening Duties timer (the off-standard module owns the write —
          this just signals + routes). Never clobbers a timer already running. */}
      {showOpeningCard && (
        <div className={`${CARD} w-full px-4 py-3.5 flex items-center gap-3`}>
          <button
            type="button"
            onClick={startOpeningDuties}
            className="flex-1 flex items-center gap-3 text-left cursor-pointer"
          >
            <span className="text-xl leading-none">🌅</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Start opening duties</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Starts the timer — gas, keys, boards</span>
            </span>
            <span className="text-gray-300 dark:text-gray-600">→</span>
          </button>
          {/* ⚠️ A SEPARATE EXIT FOR A CASE NOTHING CAN DETECT. If his partner got in first and did
              the gas, keys and boards, the work happened but left no row under HIS name — so the
              logged-check can never retire this card. Only he knows, so he needs somewhere to say
              it. Deliberately quiet: it is the rarer of the two paths, and it must not compete with
              the action itself. */}
          <button
            type="button"
            onClick={dismissOpeningCard}
            aria-label="Dismiss opening duties — already done"
            className="shrink-0 h-11 px-3 -mr-1 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition"
          >
            Dismiss
          </button>
        </div>
      )}

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
            {/* The roster's word for the day, kept visible on an overtime day: being OFF is what
                makes every logged hour time-and-a-half, so the headline must not swallow it. */}
            {day.shiftSubLabel && (
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{day.shiftSubLabel} · every hour at 1.5x</p>
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

        {day.working && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2 mb-0.5">
              On with you today · {day.team.length}
            </p>
            <TeamRoster team={day.team} setShiftAttendance={day.setShiftAttendance} />
          </div>
        )}
      </section>

      {/* ── Schedule heads-ups (clopen, solo floor) — only when today has one ─ */}
      {day.insights.length > 0 && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-4 space-y-2.5 transition-colors">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-500/80">Heads up today</p>
          <ul className="space-y-2.5">
            {day.insights.map(ins => (
              <li key={ins.kind} className="flex items-start gap-2.5">
                <span aria-hidden className="text-base leading-none mt-0.5">{ins.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ins.label}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{ins.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Plates on watch ─────────────────────────────────────────────────
          The whiteboard by the off-standard sheets, in FG. Sits with the heads-ups
          because that is what it is. ⚠️ The SCAN is what makes a watch work
          (ScanPlateWatch) — this is where one is set and seen, not where it is caught. */}
      <PlateWatchCard />
      {/* His own trail — silent until he has been somewhere, so it fills up through the shift. */}
      <MyTrailCard />

      {/* ── First action — the ritual: fleet balance, else check-in ──────── */}
      {day.working && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {/* "First up" is an opener's ritual and it isn't his on a called-in day — the balance
                  belongs to whoever is rostered. The card still shows, because he is the one who
                  actually feeds FG (Aaron, 2026-08-22: "Geoff has it... he rarely uses FG"), so
                  hiding it would remove the only path by which the number ever gets logged. */}
              {day.balanceLogged ? "Today's fleet balance" : day.overtime ? 'Fleet balance — not logged yet' : 'First up — log the fleet balance'}
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
            className={
              day.checkInDoneToday
                ? 'w-full py-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 text-sm font-semibold text-green-700 dark:text-green-400 hover:border-green-300 dark:hover:border-green-800 transition cursor-pointer'
                : 'w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer'
            }
          >
            {day.checkInDoneToday ? (
              <>✓ {day.isMid ? 'Mid-shift check-in' : 'Afternoon check-in'} logged
                {day.checkInCarsToday != null && ` · ${day.checkInCarsToday} cars`} →</>
            ) : (
              <>{day.balanceLogged ? 'Next: ' : 'Not available yet? '}
                {day.isMid ? 'Log mid-shift check-in' : 'Log afternoon check-in'} →</>
            )}
          </button>
        </section>
      )}

      {/* ── What the day started with ────────────────────────────────────────
          NOT gated to openings any more (Aaron, 2026-08-25, on a MID: *"this
          shouldn't be buried in the shift hand-off"*). The gate assumed an OPENER
          exists to inherit the lot and reconstruct a missing close — the same
          absent-second-person assumption as the fuel relay and the codex. On a mid
          or a close the card simply never rendered, so the ONLY surface offering
          the backfill was the one inside the Log Shift Handoff modal.
          Last night's close is a fact about YESTERDAY (findPriorShiftLog keys on
          shiftDateStr(-1)), so the question is equally valid whoever is on today —
          and the missing number distorts the day's rate regardless of who fills it. */}
      {day.working && <OpeningLotCard openedToday={day.myShift?.shiftType === 'opening'} />}

      {/* ── Opening fuel pump readings — same place as OpeningLotCard, so an
          opener never has to switch to My Shift to log them ────────────── */}
      {day.working && day.myShift?.shiftType === 'opening' && <FuelPumpReadings user={day.user} />}

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
