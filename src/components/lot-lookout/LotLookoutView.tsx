// Lot Lookout as its own FG module, renovated into the bay log on 2026-10-29. Aaron: *"removing the airport status and
// swatches making it strictly erin st / turning it into a VSA module for cleaning / look up vehicle, enter odo ...
// someone with the read-only link can see which vehicle we're currently cleaning ... once done, goes on the cleaned
// list"*. Ticket: docs/ticket-lot-lookout-bay-log.md. (Its first life, 2026-10-15: today's crew and the airport's live
// taps. The airport went: *"airport lot data is hard to keep track of"*.)
//
// Top to bottom, in the order he uses it: the car in the bay and its exits, Erin St's count (the SAME blocks as the
// Erin pill's sheet: *"steppers, use the same style as the header"*), today's list, the crew, the links.
import { useCallback, useState } from 'react';
import { initialsOf } from '../../lib/lotLookout';
import { inTheBay } from '../../lib/lotBayLog';
import { shiftDayLabel } from '../../lib/shiftDay';
import { useBayLog } from '../../hooks/useBayLog';
import { useLotBay } from '../../hooks/useLotBay';
import { useBayTapsSignedIn } from '../../hooks/useBayTaps';
import { useLotCrew } from '../../hooks/useLotCrew';
import { useUndoNote } from '../../hooks/useUndoNote';
import { useAuth } from '../../context/AuthContext';
import { useScanRouter } from '../../context/scanRouter';
import { ModuleHeader } from '../shared/ModuleHeader';
import { LotCrewLine } from '../lot/LotCrewLine';
import { BayInTheBay } from '../lot/BayInTheBay';
import { BayLogList } from '../lot/BayLogList';
import { ErinCountBlocks, UndoNoteBar } from '../lot/ErinCountBlocks';
import { LotCrewPanel } from '../my-day/LotCrewPanel';
import { LotLinks } from './LotLinks';
import type { Screen } from '../../types';

const SECTION_HEAD = 'px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';

export function LotLookoutView({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { user } = useAuth();
  const by = initialsOf(user?.name ?? null) || 'FG';
  const [note, show, clearNote] = useUndoNote();
  const bay = useBayLog(by);
  const erin = useLotBay();
  const taps = useBayTapsSignedIn(erin, show, by);
  const { crew, leaveOff } = useLotCrew({ signedIn: true });
  const { search } = useScanRouter();
  const [busy, setBusy] = useState(false);
  const [bumped, setBumped] = useState(false);
  const open = inTheBay(bay.rows);

  /** One exit, said out loud: the note names the car, and Clean / Skip can be taken back for 5 s. */
  const settle = useCallback(async (run: () => Promise<string | null>, done: string, undo?: () => void) => {
    setBusy(true);
    const err = await run();
    setBusy(false);
    if (err) { show(err); return false; }
    show(done, undo);
    return true;
  }, [show]);

  const exitHere = (kind: 'clean' | 'skip') => {
    if (!open) return;
    const { id, plate } = open;
    const undo = () => void settle(() => bay.undoExit(id), `${plate} is back in the bay`).then(ok => { if (ok) setBumped(false); });
    void settle(() => bay.exit(id, kind), kind === 'clean' ? `${plate} clean` : `${plate} bumped, still to do`, undo)
      .then(ok => { if (ok) setBumped(kind === 'skip'); });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-5">
      <ModuleHeader title="Lot Lookout" subtitle="Erin St · the bay log" />

      {bay.error && <p className="text-sm text-red-700 dark:text-red-400">{bay.error}</p>}
      {bay.loaded && (
        <BayInTheBay open={open} busy={busy} bumped={bumped}
          onExit={exitHere}
          onHold={kind => open && onNavigate({ name: 'new-hold', vehicleId: open.vehicle_id, prefillNonce: Date.now(), bayExit: { id: open.id, kind } })}
          onCloseHeld={kind => open && void settle(() => bay.exit(open.id, kind), `${open.plate} closed as held`)}
          onFindCar={search} />
      )}
      {/* Only while it has something to say: an empty bar left a hole under the card (render check, 2026-10-29). */}
      {note && <UndoNoteBar note={note} clear={clearNote} />}

      {erin.bay && (
        <section aria-label="Erin St" className="space-y-2">
          <h2 className={SECTION_HEAD}>Erin St</h2>
          <ErinCountBlocks erin={erin} taps={taps} drivers={crew?.summary.driver.on ?? 0} />
        </section>
      )}

      <BayLogList rows={bay.rows} heading={`Today · ${shiftDayLabel()}`} />

      {crew && (
        <section aria-label="Crew" className="space-y-2">
          <LotCrewLine summary={crew.summary} />
          {crew.members && crew.members.length > 0 && (
            <LotCrewPanel members={crew.members} toast={show}
              leftOff={crew.leftOff} leaveOff={(u, off) => leaveOff(u, off, by)} />
          )}
        </section>
      )}

      <LotLinks />
    </div>
  );
}
