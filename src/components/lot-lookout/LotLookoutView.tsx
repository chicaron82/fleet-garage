// Lot Lookout as its own FG module, renovated into the bay log on 2026-10-29. Aaron: *"removing the airport status and
// swatches making it strictly erin st / turning it into a VSA module for cleaning / look up vehicle, enter odo ...
// someone with the read-only link can see which vehicle we're currently cleaning ... once done, goes on the cleaned
// list"*. Ticket: docs/ticket-lot-lookout-bay-log.md. (Its first life, 2026-10-15: today's crew and the airport's live
// taps. The airport went: *"airport lot data is hard to keep track of"*.)
//
// Top to bottom, in the order he uses it: the car in the bay and its exits, Erin St's count (the SAME blocks as the
// Erin pill's sheet: *"steppers, use the same style as the header"*) with On break beside its heading (2026-11-05),
// today's list and its + Add a car already cleaned (2026-11-05), the crew, the links.
import { useCallback, useState } from 'react';
import { initialsOf } from '../../lib/lotLookout';
import { inTheBay, sameHoldChoices, sameHoldLabel, unflaggedHoldIds, type BayExit, type BayLogRow, type HoldExit } from '../../lib/lotBayLog';
import type { BayListEdit } from '../lot/BayLogList';
import { shiftDateStr, shiftDayLabel } from '../../lib/shiftDay';
import { useBayLog } from '../../hooks/useBayLog';
import { useBayDay } from '../../hooks/useBayDay';
import { useLotBay } from '../../hooks/useLotBay';
import { useBayTapsSignedIn } from '../../hooks/useBayTaps';
import { useLotCrew } from '../../hooks/useLotCrew';
import { useUndoNote } from '../../hooks/useUndoNote';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useScanRouter } from '../../context/scanRouter';
import { ModuleHeader } from '../shared/ModuleHeader';
import { LotCrewLine } from '../lot/LotCrewLine';
import { BayInTheBay } from '../lot/BayInTheBay';
import { BayLogList } from '../lot/BayLogList';
import { BayAddCleaned } from '../lot/BayAddCleaned';
import { BayDayHeader } from '../lot/BayDayHeader';
import { BayBreakButton, BayBreakStrip } from '../lot/BayBreak';
import { isOnBreak, lastActivity } from '../../lib/countKept';
import { ErinCountBlocks, UndoNoteBar } from '../lot/ErinCountBlocks';
import { LotCrewPanel } from '../my-day/LotCrewPanel';
import { LotLinks } from './LotLinks';
import type { Screen } from '../../types';

const SECTION_HEAD = 'px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
/** What the note says when a car leaves. A hold is a mark on the list until it's flagged (2026-11-03, one tap). */
const EXIT_NOTE: Record<BayExit, (plate: string) => string> = {
  clean: p => `${p} clean`,
  erin: p => `${p} clean for Erin St · off the dirties`,
  skip: p => `${p} bumped, still to do`,
  mhold: p => `${p} M hold · flag it from the list`,
  bhold: p => `${p} B hold · flag it from the list`,
};

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
  // On break (migration 166): held only while nothing has happened since; any tap ends it.
  const onBreak = isOnBreak(erin.bay?.breakAt, lastActivity(erin.bay, bay.rows));
  // The day record (Phase 2): ‹ › back through his days. Today is the live log; an earlier day is history.
  const [back, setBack] = useState(0);
  const isToday = back === 0, day = shiftDateStr(-back);
  const record = useBayDay(day, user?.id ?? null, isToday);
  const [y, m, d] = day.split('-').map(Number);
  const dayLabel = isToday ? `Today · ${shiftDayLabel()}` : shiftDayLabel(new Date(y!, m! - 1, d!, 12));
  // M / B rows with no hold flagged yet carry Flag it (2026-11-03): the form when he has a minute, the car and type chosen.
  const { holds } = useVehicleHoldContext();
  const listRows: BayLogRow[] | null = isToday ? bay.rows : record.pastRows;
  const toFlag = listRows ? unflaggedHoldIds(listRows, holds) : new Set<number>();
  const flag = (id: number) => {
    const r = listRows?.find(x => x.id === id);
    if (r) onNavigate({ name: 'new-hold', vehicleId: r.vehicle_id, prefillNonce: Date.now(), fromBay: r.exit as HoldExit });
  };
  // A row saved from the list lands on whichever list it came from (today's live log, or the earlier day shown).
  const editRow = async (body: Parameters<typeof bay.editRow>[0]) => {
    const out = await bay.editRow(body);
    if ('error' in out) return out.error;
    if (!isToday) record.replaceRow(out.row);
    return null;
  };
  // Flag it, with the hold already on the car (2026-11-04): *"having it available to select"*, from the list.
  const edit: BayListEdit = {
    flagIds: toFlag,
    choicesFor: id => {
      const r = listRows?.find(x => x.id === id);
      return r ? sameHoldChoices(r, holds).map(h => ({ id: h.id, label: sameHoldLabel(h.flaggedAt) })) : [];
    },
    onNewHold: flag,
    onSameHold: (id, holdId) => editRow({ action: 'bayLinkHold', id, holdId }),
    onNote: (id, note) => editRow({ action: 'bayNote', id, note }),
    // His delete (2026-11-06): today's list only. The server refuses an earlier day too.
    ...(isToday ? { onRemove: bay.remove } : {}),
  };

  /** One exit, said out loud: the note names the car, and Clean / Skip can be taken back for 5 s. */
  const settle = useCallback(async (run: () => Promise<string | null>, done: string, undo?: () => void) => {
    setBusy(true);
    const err = await run();
    setBusy(false);
    if (err) { show(err); return false; }
    show(done, undo);
    return true;
  }, [show]);

  const exitHere = (kind: BayExit, odometer?: number, pull?: false) => {
    if (!open) return;
    const { id, plate } = open;
    const odoNote = odometer != null ? ` · odo ${odometer.toLocaleString('en-CA')}` : '';
    const waits = pull === false ? ' · on deck waits' : '';
    const undo = () => void settle(() => bay.undoExit(id), `${plate} is back in the bay`).then(ok => { if (ok) setBumped(false); });
    void settle(() => (pull === false ? bay.exit(id, kind, odometer, false) : odometer != null ? bay.exit(id, kind, odometer) : bay.exit(id, kind)),`${EXIT_NOTE[kind](plate)}${odoNote}${waits}`, undo)
      .then(ok => { if (ok) setBumped(kind === 'skip'); });
  };
  // + Add a car already cleaned (2026-11-05, docs/ticket-bay-add-a-car-cleaned.md): the note names it, and Undo takes it off.
  const addHere = async (vehicleId: string, plate: string) => {
    setBusy(true);
    const out = await bay.add(vehicleId);
    setBusy(false);
    if (!out) return false;
    if ('error' in out) { show(out.error); return false; }
    show(`${plate} added as clean`, () => void settle(() => bay.undoAdd(out.id), `${plate} taken off the list`));
    return true;
  };
  // No Undo on the note: the car is on deck, and its ▶ Start cleaning brings it straight back.
  const bumpHere = (replace: boolean) => {
    if (!open) return;
    const { id, plate } = open;
    void settle(() => bay.bump(id, replace), `${plate} back on deck, not cleaned`).then(ok => { if (ok) setBumped(false); });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-5">
      <ModuleHeader title="Lot Lookout" subtitle="Erin St · the bay log" />

      {bay.error && <p className="text-sm text-red-700 dark:text-red-400">{bay.error}</p>}
      <BayDayHeader label={dayLabel} isToday={isToday} canForward={back > 0} mine={record.mine} nowMs={erin.nowMs}
        onBack={() => setBack(b => b + 1)} onForward={() => setBack(b => Math.max(0, b - 1))} onToday={() => setBack(0)} />
      {record.error && <p className="text-sm text-red-700 dark:text-red-400">{record.error}</p>}

      {isToday && bay.loaded && (
        <BayInTheBay open={open} busy={busy} bumped={bumped}
          onExit={exitHere} onBump={bumpHere}
          onCloseHeld={kind => open && void settle(() => bay.exit(open.id, kind), `${open.plate} closed as held`)}
          onFindCar={search} bay={bay}
          onOpenCar={vehicleId => onNavigate({ name: 'vehicle', vehicleId })} />
      )}
      {isToday && bay.nextIssue && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-400">{bay.nextIssue}</p>}
      {/* Only while it has something to say: an empty bar left a hole under the card (render check, 2026-10-29). */}
      {note && <UndoNoteBar note={note} clear={clearNote} />}

      {isToday && erin.bay && (
        <section aria-label="Erin St" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className={SECTION_HEAD}>Erin St</h2>
            {!onBreak && <BayBreakButton onBreak={() => void taps.setBreak(true)} />}
          </div>
          {onBreak && <BayBreakStrip onBack={() => void taps.setBreak(false)} />}
          <ErinCountBlocks erin={erin} taps={taps} drivers={crew?.summary.driver.on ?? 0} />
        </section>
      )}

      {isToday ? (
        <div className="space-y-2">
          <BayLogList rows={bay.rows} heading="The bay log" edit={edit} />
          {bay.loaded && <BayAddCleaned onAdd={addHere} onMore={search} />}
        </div>
      )
        : record.pastRows ? <BayLogList rows={record.pastRows} heading="The bay log" empty="No cars through the bay that day." edit={edit} />
        : <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading that day…</p>}

      {isToday && crew && (
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
