// Lot Lookout as its own FG module. Aaron, 2026-10-15: *"What do you think of having lot outlook as an FG
// module?"* ... *"A now thing for us to polish"*.
//
// One full screen for what had been spread across a My Day card and three outside links: Erin St's count, today's
// crew with the named list open (it had been squeezed into a fold), and the airport board with live taps. Signed in
// to FG, so there is no PIN anywhere here — api/lot.ts takes the session for every action, and the crew ONLY from a
// session. The drivers' /lot page, /lot/erin and /lot/view are untouched; this is another door to the same rows.
import { useMemo } from 'react';
import { initialsOf, lotTotals } from '../../lib/lotLookout';
import { useLotBoard } from '../../hooks/useLotBoard';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotCrew } from '../../hooks/useLotCrew';
import { useLotToast } from '../../hooks/useLotToast';
import { useBayTapsSignedIn } from '../../hooks/useBayTaps';
import { useLotTapsSignedIn } from '../../hooks/useLotTaps';
import { useAuth } from '../../context/AuthContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { LotBayStrip } from '../lot/LotBayStrip';
import { LotCrewLine } from '../lot/LotCrewLine';
import { LotSummary } from '../lot/LotSummary';
import { LotMap } from '../lot/LotMap';
import { LotToast } from '../lot/LotChrome';
import { LotCrewPanel } from '../my-day/LotCrewPanel';
import { LotLinks } from './LotLinks';

const SECTION_HEAD = 'text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';

export function LotLookoutView() {
  const board = useLotBoard();
  const erin = useLotBay();
  const { crew, mark, leaveOff } = useLotCrew({ signedIn: true });
  const { user } = useAuth();
  const by = initialsOf(user?.name ?? null);
  const [toastMsg, toast] = useLotToast();
  const bayTaps = useBayTapsSignedIn(erin, toast, by);
  const stallTaps = useLotTapsSignedIn(board, toast, by);
  const totals = useMemo(() => lotTotals(board.stalls, board.aisle, board.nowMs), [board.stalls, board.aisle, board.nowMs]);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* The airport's verdict is NOT repeated up here: LotSummary says it in its own box a screen below. */}
      <ModuleHeader title="Lot Lookout" subtitle="Erin St, the airport and today's crew, live" />

      {/* No heading of our own: the strip carries its own "Erin St". */}
      <section aria-label="Erin St">
        {erin.bay ? (
          <LotBayStrip bay={erin.bay} nowMs={erin.nowMs}
            controls={{ onCleans: d => void bayTaps.tapCleans(d), onDirties: bayTaps.setDirties }} />
        ) : erin.loaded ? <p className="text-sm text-red-700 dark:text-red-400">Erin St's count could not load.</p> : null}
      </section>

      {crew && (
        <section aria-label="Crew" className="space-y-2">
          <LotCrewLine summary={crew.summary} changedAt={crew.changedAt} />
          {crew.members && crew.members.length > 0 && (
            <LotCrewPanel members={crew.members} mark={(u, st) => mark(u, st, by || 'FG')} toast={toast}
              leftOff={crew.leftOff} leaveOff={(u, off) => leaveOff(u, off, by || 'FG')} />
          )}
        </section>
      )}

      <section aria-label="Airport" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className={SECTION_HEAD}>Airport</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">1965 Wellington</span>
        </div>
        {board.error && <p className="text-sm text-red-700 dark:text-red-400">{board.error}</p>}
        {board.loaded && !board.error && (
          <>
            <LotSummary totals={totals} aisleCars={board.aisle.cars} />
            <LotMap stalls={board.stalls} aisle={board.aisle} nowMs={board.nowMs} nPulse={totals.nPulse}
              onTap={(stall, state) => void stallTaps.tapStall(stall, state)} onAisle={d => void stallTaps.tapAisle(d)} />
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Tap a colour on a stall: white open, green clean, red dirty. Tap the same colour again within 5 seconds to
              undo. Hold a stall to grey it out as taken; hold it again to free it. Your taps show as {by || 'FG'}.
            </p>
          </>
        )}
      </section>

      <LotLinks />
      <LotToast msg={toastMsg} />
    </div>
  );
}
