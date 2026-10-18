// Lot Lookout as its own FG module. Aaron, 2026-10-15: *"What do you think of having lot outlook as an FG
// module?"* ... *"A now thing for us to polish"*.
//
// One full screen for what had been spread across a My Day card and three outside links: today's crew with the named
// list open (it had been squeezed into a fold), and the airport with live taps. Signed in
// to FG, so there is no PIN anywhere here — api/lot.ts takes the session for every action, and the crew ONLY from a
// session. The drivers' /lot page, /lot/erin and /lot/view are untouched; this is another door to the same rows.
//
// ⭐ No Erin St section (2026-10-18): *"while we now have the header for erin st. how bout removing it from "my day" and
// "lot loookout" modules"*. The Erin pill in the top bar opens the same count with more taps (ErinCountSheet).
import { useCallback } from 'react';
import { initialsOf } from '../../lib/lotLookout';
import { useLotAirport } from '../../hooks/useLotAirport';
import { useAirportTaps } from '../../hooks/useAirportTaps';
import { postLotSignedIn, type LotPost } from '../../hooks/useLotPin';
import { useLotCrew } from '../../hooks/useLotCrew';
import { useLotToast } from '../../hooks/useLotToast';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { attendanceForCrew, shiftsToMark } from '../../lib/rosterCrew';
import type { CrewState } from '../../lib/lotCrew';
import { ModuleHeader } from '../shared/ModuleHeader';
import { LotCrewLine } from '../lot/LotCrewLine';
import { AirportNotches } from '../lot/AirportNotches';
import { LotToast } from '../lot/LotChrome';
import { LotCrewPanel } from '../my-day/LotCrewPanel';
import { LotLinks } from './LotLinks';

const SECTION_HEAD = 'text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';

export function LotLookoutView() {
  const airport = useLotAirport('lot-airport-module');
  const { crew, mark, leaveOff } = useLotCrew({ signedIn: true });
  const { user } = useAuth();
  const by = initialsOf(user?.name ?? null);
  const [toastMsg, toast] = useLotToast();
  const fail = useCallback((r: LotPost) => toast(r.error ?? 'The tap did not save.'), [toast]);
  // ⭐ Lot Lookout → My Day (2026-10-18, his "triple yes" to "they should affect eachother"): a crew chip here also marks
  // them on My Day: Out is a no-show, any job (or back to the default) is present. Through the schedule's own setter,
  // so My Day shows it the moment he goes back, without a reload.
  const { todayShifts, setShiftAttendance } = useSchedule();
  // Attendance FIRST: the crew write answers with a fresh count, and "back to the default" is only counted as working
  // once they are present. The other order showed them as "not marked yet" until the next minute's read.
  const markAndAttend = useCallback(async (users: string[], next: CrewState | 'clear') => {
    const to = attendanceForCrew(next);
    await Promise.all(shiftsToMark(todayShifts, users, to).map(id => setShiftAttendance(id, to)));
    return mark(users, next, by || 'FG');
  }, [mark, by, todayShifts, setShiftAttendance]);
  const airTaps = useAirportTaps({ airport, send: postLotSignedIn, by: by || 'FG', queueKey: 'lot_airport_queue_fg', onFail: fail, toast });

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-6">
      <ModuleHeader title="Lot Lookout" subtitle="The airport and today's crew, live" />

      {crew && (
        <section aria-label="Crew" className="space-y-2">
          <LotCrewLine summary={crew.summary} changedAt={crew.changedAt} />
          {crew.members && crew.members.length > 0 && (
            <LotCrewPanel members={crew.members} mark={markAndAttend} toast={toast}
              leftOff={crew.leftOff} leaveOff={(u, off) => leaveOff(u, off, by || 'FG')} />
          )}
        </section>
      )}

      <section aria-label="Airport" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className={SECTION_HEAD}>Airport</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">1965 Wellington</span>
        </div>
        {airport.error && <p className="text-sm text-red-700 dark:text-red-400">{airport.error}</p>}
        {airport.loaded && !airport.error && (
          <>
            {airTaps.waiting > 0 && (
              <p role="status" className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {airTaps.waiting} {airTaps.waiting === 1 ? 'tap' : 'taps'} waiting for signal. They send by themselves.
              </p>
            )}
            <AirportNotches shown={airTaps.shown} nowMs={airport.nowMs} onTap={(f, v) => void airTaps.tap(f, v)} />
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Normally the drivers' readings. One tap saves, the newest reading wins. Your taps show as {by || 'FG'}.
            </p>
          </>
        )}
      </section>

      <LotLinks />
      <LotToast msg={toastMsg} />
    </div>
  );
}
