// Which of Effie's resolved writes belong to ONE car — the per-record half of the provenance
// trail that used to live only as a global list on the pending screen.
//
// ⭐ WHY IT MOVED. `EffieAuditSection` wore the same badge as the two ACTIONABLE queues beside it:
// identical pill, identical bold count, differing only in colour (orange = act, amber = look,
// grey = done). Aaron, 2026-08-29: *"having a badge persist at 12 reads as if i still need to do
// something with them"*. Shape beats colour — a filled pill with a number is queue grammar, and no
// shade of grey talks it out of that. The count is gone from that header, and the trail moved to
// where the question is actually asked: standing at the car, wondering why the record says that.
//
// ⭐⭐ AND IT ANSWERS THE ONE THING `VehicleChangeLog` CANNOT. That component's own header is
// explicit: *"It never says WHO. FG writes with the anon key under allow-all RLS, so no honest
// actor exists to name."* True of a raw `vehicle_changes` row — and NOT true here.
// `effie_pending_writes` carries `proposed_by` and `resolved_by` as real profile ids, because a
// proposal was made by something and approved by someone. This is the narrow slice of the record's
// history where an actor is honestly knowable, so it is the only slice allowed to name one.
import { normalizePlate } from './vehicleByPlate';
import type { Proposal } from '../../api/_lib/holdProposal';

export interface EffieWriteLike {
  id: string;
  kind: string;
  proposal: Proposal;
  source: string;
  status: 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
  proposedBy: string;
  resolvedBy: string | null;
}

/** The car a proposal points at, as far as the proposal itself knows. */
export interface ProposalTarget {
  /** Present only for proposals about an ALREADY-REGISTERED car. */
  vehicleId: string | null;
  /** Normalized, or '' when the proposal names no plate at all. */
  plate: string;
}

/**
 * ⚠️ A REGISTER PROPOSAL HAS NO `vehicleId`, and that is the whole reason a plate match exists.
 * `register_vehicle` / `register_and_hold` describe a car that did not exist yet when Effie
 * proposed it — the id is minted on approval, so the proposal can never carry it. Matching on id
 * alone would silently hide every registration from the record of the car it created, which is
 * exactly the row a person is most likely to be asking about.
 */
export function proposalTarget(proposal: Proposal | null | undefined): ProposalTarget {
  const p = proposal as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== 'object') return { vehicleId: null, plate: '' };

  const nested = p.vehicle as { vehicleId?: unknown; plate?: unknown } | undefined;
  const created = p.newVehicle as { plate?: unknown } | undefined;

  const id =
    typeof p.vehicleId === 'string' ? p.vehicleId :
    typeof nested?.vehicleId === 'string' ? nested.vehicleId : null;

  const rawPlate =
    typeof p.plate === 'string' ? p.plate :
    typeof nested?.plate === 'string' ? nested.plate :
    typeof created?.plate === 'string' ? created.plate :
    typeof p.licensePlate === 'string' ? p.licensePlate : '';

  return { vehicleId: id, plate: normalizePlate(rawPlate) };
}

/**
 * The resolved Effie writes belonging to this car, newest first.
 *
 * ⚠️ An EMPTY plate never matches an empty plate. A proposal with no vehicle in it at all
 * (`navigate`, `memory`, `reminder`) normalizes to `''`, and so does a car queried with a missing
 * plate — so a loose equality check would attach every non-vehicle proposal Effie has ever made to
 * whichever record happened to load without one. Both sides must be non-empty to match.
 */
export function effieWritesForVehicle<T extends EffieWriteLike>(
  writes: readonly T[],
  vehicleId: string | null | undefined,
  licensePlate: string | null | undefined,
): T[] {
  const plate = normalizePlate(licensePlate ?? '');
  const id = (vehicleId ?? '').trim();
  if (!id && !plate) return [];

  const hits = writes.filter(w => {
    const t = proposalTarget(w.proposal);
    if (id && t.vehicleId === id) return true;
    return Boolean(plate) && t.plate === plate;
  });

  // Newest first, matching every other trail on the vehicle screen. `createdAt` is when Effie
  // PROPOSED it, which is the moment the operator remembers — not when they got round to approving.
  return hits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const KIND_LABELS: Readonly<Record<string, string>> = {
  hold: 'Flagged a hold',
  register_and_hold: 'Registered the car and flagged a hold',
  register_vehicle: 'Registered the car',
  update_vehicle: 'Filled in blank fields',
  update_and_hold: 'Filled in blanks and flagged a hold',
  lost_item: 'Logged a lost item',
};

/** A human line for one row: what Effie proposed, in the operator's words rather than the schema's. */
export function describeEffieWrite(write: EffieWriteLike): string {
  return KIND_LABELS[write.kind] ?? write.kind.replace(/_/g, ' ');
}
