import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useMyTrail, startOfToday } from '../../hooks/useMyTrail';
import { buildTrail, trailHeadline, stopName } from '../../lib/myTrail';
import { clockOf } from '../../lib/vehicleChanges';

// Where he has been today — the one surface in FG that speaks about HIM.
//
// ⭐ WHY IT EXISTS. `sightings.ts` has said it since August: "`vehicle_changes` has watched him work
// since 2026-08-19, and every write he makes at a car is an interaction." FG surfaces that only from
// the CAR's point of view — open a vehicle, read its history. Nothing anywhere talks about the
// person doing the work. He is the man whose absence had to do the arithmetic before anyone noticed
// what he carried; FG has the receipts on him and showed them to nobody, including him.
//
// ⭐ Pure MSG: zero new data, zero new collection. The same rows, read down the other axis.
//
// ⚠️ It is a RECEIPT, not a retrospective. Every line is something FG was present for. It cannot
// answer "your best Thursday" (reference_fg_data_blind_spots) and does not try.
//
// ⚠️ SILENT WHEN EMPTY — the established FG pattern (VehicleChangeLog, PlateWatchCard). It means the
// card FILLS UP as his shift goes on instead of greeting him with a zero at 6:45am.
//
// ⚠️ COLLAPSED BY DEFAULT (Aaron, 2026-09-07): *"this block is useful but it takes up space
// especially if I have a busy day. what do you think of having it collapsed by default telling me
// how much then expand to see in full"*. On an 86-car day the list buried everything below it —
// the same defect the Fleet analytics cards had the day before (`0786081`), where a useful summary
// pushed the actual work under the fold.
//
// ⭐ ALWAYS collapsed, never remembered — his call, and it matches Fleet. A remembered expansion
// would mean the card is tall again on exactly the busy days it was shrunk for.
// ⭐ The COUNT stays on the face, because the count is the part he wanted: the headline already says
// what he did today, and the list is the receipt he opens only when he wants it.
export function MyTrailCard() {
  const { user } = useAuth();
  const { allVehicles } = useVehicleHoldContext();

  // ⚠️ `dizee` alongside his id: an agent writing on his behalf is still his work at that car, and
  // `vehicle_changes.actor` records it by name (migration 132). 37 rows and counting.
  // ⚠️ `uid` hoisted rather than `user?.id` inline: the React Compiler infers the dependency as
  // `user` and refuses to preserve a memo whose stated dep is narrower than the inferred one.
  const uid = user?.id;
  const actors = useMemo(() => (uid ? [uid, 'dizee'] : []), [uid]);
  const since = useMemo(() => startOfToday(), []);
  const rows = useMyTrail(actors, since);

  const stops = useMemo(() => {
    const byId = new Map(allVehicles.map(v => [v.id, v]));
    return buildTrail(rows, actors, id => {
      const v = byId.get(id);
      return v ? { plate: v.licensePlate ?? null, unitNumber: v.unitNumber ?? null } : null;
    });
  }, [rows, actors, allVehicles]);

  const headline = trailHeadline(stops);
  const [open, setOpen] = useState(false);
  if (!headline) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{headline}</span>
        {/* ⭐ The affordance has to say there IS more, or a collapsed card reads as the whole thing —
            which would hide the receipt rather than tidy it. */}
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {open ? 'Hide' : `Show ${stops.length}`} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (<>
      {/* ⭐ ONE GRID FOR THE WHOLE LIST, not a flex row per line — that is what makes the columns
          line up. Each <li> is `display: contents`, so its three cells join the parent's grid and
          every row shares the same three tracks. Aaron, 2026-09-11: *"is it possible to display it
          in a table so items line up."*
          ⚠️ `min-w-0` on the middle track is what lets the chips wrap instead of pushing the clock
          off the row on a car he touched five ways. */}
      {/* ⚠️ PLATE AND UNIT ARE THEIR OWN TRACKS (2026-09-11). They shipped as one joined cell an hour
          earlier and he caught it immediately: *"it bugs me that the unit numbers don't align"* —
          plates vary in length, so a single cell starts every unit at a different x. Columns only
          line up when each field owns a track. */}
      <ul className="mt-3 grid grid-cols-[max-content_max-content_minmax(0,1fr)_max-content] items-baseline gap-x-3 gap-y-2 text-xs">
        <li className="contents text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <span>Car</span><span>Unit</span><span>Did</span><span className="text-right">Time</span>
        </li>
        {stops.map(stop => (
          <li key={stop.vehicleId} className="contents">
            {stop.plate || stop.unitNumber ? (<>
              <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{stop.plate ?? '—'}</span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400">{stop.unitNumber ?? '—'}</span>
            </>) : (
              /* Neither key on record — `stopName` says so in words, across both tracks. */
              <span className="col-span-2 text-gray-500 dark:text-gray-400">{stopName(stop)}</span>
            )}
            <span className="flex flex-wrap gap-1 min-w-0">
              {stop.did.map(d => (
                <span key={d} className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {d}
                </span>
              ))}
            </span>
            {/* No "today" — every row on this card is today, so the word was on all of them. */}
            <span className="text-right tabular-nums text-gray-400 dark:text-gray-500">{clockOf(stop.at)}</span>
          </li>
        ))}
      </ul>
      {/* The count is deliberately NOT in the headline: he thinks in cars he stood at, not writes. */}
      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        Recorded as you worked — nothing here was reconstructed after the fact.
      </p>
      </>)}
    </div>
  );
}
