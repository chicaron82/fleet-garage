// FG's side of Lot Lookout on My Day: a GLANCE, since Lot Lookout became its own module (Aaron, 2026-10-15: *"What
// do you think of having lot outlook as an FG module?"*). The airport's verdict, today's crew as numbers, the airport's
// readings (migration 157), and one way into the module. The named crew list and the links live in the module
// (LotLookoutView).
//
// ⭐ No Erin St strip (2026-10-18): *"while we now have the header for erin st. how bout removing it from "my day" and
// "lot loookout" modules"*. The Erin pill in the top bar opens the same count with more taps (ErinCountSheet).
//
// Hidden until the airport row exists (migration 157) so a missing table never shows an error on his landing screen.
import { NOTCH_HEX, ROOM_TEXT } from '../../lib/lotAirport';
import { useLotAirport } from '../../hooks/useLotAirport';
import { useLotCrew } from '../../hooks/useLotCrew';
import { LotCrewLine } from '../lot/LotCrewLine';
import { AirportReadout } from '../lot/AirportReadout';

export function LotLookoutCard({ cardClass, onOpen }: { cardClass: string; onOpen: () => void }) {
  const airport = useLotAirport('lot-airport-myday');
  const { crew } = useLotCrew({ signedIn: true });
  if (!airport.loaded || airport.error) return null;
  const cleans = airport.readings.cleans;

  return (
    <section className={`${cardClass} px-4 py-3.5 space-y-3`} aria-label="Lot Lookout">
      <button type="button" onClick={onOpen}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Lot Lookout · live</span>
          <span className="block text-sm font-semibold" style={cleans == null ? undefined : { color: NOTCH_HEX[cleans] }}>
            {cleans == null ? 'Airport: not read yet' : `Airport: ${ROOM_TEXT[cleans]}`}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-gray-700 dark:text-gray-200">Open Lot Lookout ›</span>
      </button>

      {crew && <LotCrewLine summary={crew.summary} />}

      <AirportReadout r={airport.readings} nowMs={airport.nowMs} />
    </section>
  );
}
