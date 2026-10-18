// /lot/view — both lots, read only. No PIN, no buttons: for whoever just wants the count without texting the bay
// (Aaron, 2026-10-15: *"Without the constant message. "What's the count?/How many clean and dirty?""*).
//
// His rulings for it, 2026-10-15: its own link, so nothing can be tapped by accident and it outlives a PIN change;
// and times, never initials — it is about the count, not about who is working. Reading was already open (migration
// 151's read policies); the PIN guards the buttons, and there are none here. So no stall map either: the map shows
// who tapped each stall. (The map itself was retired 2026-10-18, migration 157: the airport is two readings now.)
//
// Today's crew (migration 154) shows as NUMBERS from GET /api/lot, which never sends this page a name.
import { useLotAirport } from '../../hooks/useLotAirport';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotCrew } from '../../hooks/useLotCrew';
import { AirportReadout } from './AirportReadout';
import { LotBayStrip } from './LotBayStrip';
import { LotCrewLine } from './LotCrewLine';

export function LotViewPage() {
  const airport = useLotAirport('lot-airport-view');
  const erin = useLotBay();
  const { crew } = useLotCrew();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pt-3 pb-10 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-extrabold">Lot Lookout</h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">Both lots · read only</span>
        </div>
        {!erin.loaded || !airport.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the counts…</p> : (
          <>
            {erin.bay ? <LotBayStrip bay={erin.bay} nowMs={erin.nowMs} />
              : <p className="text-sm text-red-700 dark:text-red-400">Erin St's count could not load.</p>}
            {crew && <LotCrewLine summary={crew.summary} changedAt={crew.changedAt} />}
            <section aria-label="Airport" className="space-y-1">
              <h2 className="px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Airport</h2>
              {airport.error ? <p className="text-sm text-red-700 dark:text-red-400">{airport.error}</p>
                : <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3"><AirportReadout r={airport.readings} nowMs={airport.nowMs} /></div>}
            </section>
          </>
        )}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">Updates by itself. Every number shows when it was last counted.</p>
      </div>
    </div>
  );
}
