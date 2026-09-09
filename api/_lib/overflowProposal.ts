// A batch of overflow sends the user asks Effie to log ("these went to AV Flight").
// Drafted by the proxy (api/fg-chat), written only on the confirm tap — the client
// then writes one completed one-way vsa_trips row per vehicle (src/lib/overflowTrip).
// The Movement Log shows them, and "where's X?" names the real spot across days.
// Owns the destination taxonomy so the server tool, the client card, and the trip
// builder all share one source (client/src may import api/_lib; the reverse can't).

/** The overflow spots FG sends surplus vehicles to at end of shift. "Airport" = Richardson International. */
export type OverflowDestination = 'AV Flight' | 'FastAir' | 'Airport';
export const OVERFLOW_DESTINATIONS: readonly OverflowDestination[] = ['AV Flight', 'FastAir', 'Airport'];

/**
 * ⭐⭐ THE TAG READ, when this vehicle came from a photo rather than a typed plate.
 *
 * Aaron, 2026-09-08: *"anything that reads keytags shouldn't be tossing out valuable info"* — said
 * after logging three cars through the chat and finding one still hollow. The chat tool used to
 * take an array of plate STRINGS, so the model looked at a tag carrying unit, owning area, rental
 * class, model code, VIN and colour, and had nowhere to put any of it.
 *
 * ⭐⭐⭐ THE SERVER READS; THE CLIENT DECIDES. The read happens in the executor because only the
 * server has the API key and the measured two-tier reader (`_lib/keytagReader`). What the read
 * MEANS for a vehicle record is decided on the client, because that is where the live fleet list
 * lives and where the shipped deciders (`resolveKeytagScan`, `backfillFieldsOnScan`) already run —
 * the same ones the Movement Log form uses. So this field carries observations, never conclusions,
 * and there is still exactly one implementation of what to do with them.
 */
export type { KeytagRead } from './keytagRead.js';

/** One vehicle in an overflow batch — resolved to a fleet row where possible. */
export interface OverflowVehicle {
  /** Plate to log on the trip: the canonical fleet plate, or the raw input if unresolved. */
  plate: string;
  unit: string | null;
  /** Human label for the card — "Unit 1234" or the plate. */
  label: string;
  /** True when the plate didn't match a fleet row (logged as entered). */
  unresolved: boolean;
  /** What the key tag said, when this vehicle came from a photo. Absent for a typed plate. */
  read?: import('./keytagRead.js').KeytagRead;
  /** Which attached photo produced it, so the client can attach that image to the car it names. */
  photoIndex?: number;
}

/** A batch of end-of-shift sends the user is being asked to confirm before it's logged. */
export interface OverflowLogProposal {
  kind: 'overflow_log';
  destination: OverflowDestination;
  vehicles: OverflowVehicle[];
}

/** Build an overflow-log proposal. Pure — no I/O, no write. */
export function buildOverflowProposal(destination: OverflowDestination, vehicles: OverflowVehicle[]): OverflowLogProposal {
  return { kind: 'overflow_log', destination, vehicles };
}

/** A short one-liner the AI/tool can echo back. */
export function describeOverflowProposal(p: OverflowLogProposal): string {
  const n = p.vehicles.length;
  return `log ${n} vehicle${n === 1 ? '' : 's'} sent to ${p.destination}`;
}
