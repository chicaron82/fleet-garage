// The airport's readings, read only, the way the BAY reads them (migration 157): room for cleans, returns, the aisle,
// each with when it was set. Shown by the top bar's squares (AirPill), My Day's card and /lot/view.
//
// Why it reads as ROOM: Aaron, 2026-10-18, *"to make the call from the bay if i should pull the VSA's personally to move
// cars before management decides to do it when its inconvenient"*. No reading ever fades (*"scrap the stale time"*), so
// the time beside each line is how its age is told.
import { minutesAgo, shortAgo } from '../../lib/lotLookout';
import { clockOf } from '../../lib/lotBay';
import { NOTCH_HEX, RETURNS_TEXT, ROOM_TEXT, type AirportReadings } from '../../lib/lotAirport';

function when(at: string | null, nowMs: number): string {
  if (!at) return 'not read yet';
  const ago = shortAgo(minutesAgo(at, nowMs));
  return ago === 'now' ? `${clockOf(at)} · now` : `${clockOf(at)} · ${ago}`;
}

function Line({ hex, text, at, nowMs }: { hex: string | null; text: string; at: string | null; nowMs: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-2 min-w-0 text-sm font-bold text-gray-900 dark:text-gray-100">
        <span aria-hidden="true" className={`shrink-0 w-3 h-3 rounded-[3px] ${hex ? '' : 'border border-gray-400'}`} style={hex ? { background: hex } : undefined} />
        <span className="truncate">{text}</span>
      </span>
      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{when(at, nowMs)}</span>
    </div>
  );
}

export function AirportReadout({ r, nowMs }: { r: AirportReadings; nowMs: number }) {
  return (
    <div className="space-y-2">
      <Line hex={r.cleans == null ? null : NOTCH_HEX[r.cleans]} text={r.cleans == null ? 'Room for cleans: not read' : ROOM_TEXT[r.cleans]} at={r.cleansAt} nowMs={nowMs} />
      <Line hex={r.returns == null ? null : NOTCH_HEX[r.returns]} text={r.returns == null ? 'Returns: not read' : RETURNS_TEXT[r.returns]} at={r.returnsAt} nowMs={nowMs} />
      <Line hex={r.aisle ? NOTCH_HEX[0] : null} text={r.aisle ? 'Cars in the aisle' : 'Aisle clear'} at={r.aisleAt} nowMs={nowMs} />
    </div>
  );
}
