// The per-scan plan for a CLIENT-SIDE overflow send (Movement Log → "Log overflow sends"):
// unlike the Effie-chat overflow (plates-only, can't register), a client key-tag scan has the
// full identity in hand — so a send can ALSO register a new car or backfill a partial one, and
// only a genuinely-unreadable-for-registration tag logs as an orphan (flagged). Pure: resolve
// the read against the fleet, decide the fleet write + the send vehicle. Reuses the shipped
// resolve/register/backfill deciders so there's one source of truth.
import { resolveKeytagScan, newVehicleToRegisterOnScan, backfillFieldsOnScan } from './resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { NewVehicle } from '../../api/_lib/holdProposal';
import type { KeytagFill } from './resolveKeytag';
import type { Vehicle } from '../types';

export interface OverflowScanResult {
  /** The vehicle to log the send against (buildOverflowTrip needs plate + unit). */
  send: { plate: string; unit: string | null; label: string };
  /** Non-null → register this new car before logging the send. */
  register: NewVehicle | null;
  /** Non-null → apply these fields (blank fills + non-locked tag corrections) on the on-record
   *  vehicle before the send. `applies` is what the write sets, stamped 'tag'. */
  backfill: { vehicleId: string; applies: KeytagFill[] } | null;
  /** True = new to the fleet but the tag was too partial to register — the send is an orphan. */
  unregistered: boolean;
}

const labelFor = (unit: string | null | undefined, plate: string): string =>
  unit ? `Unit ${unit}` : plate;

/** Plan one overflow scan, or null if the tag was unreadable (no plate → nothing to log). */
export function planOverflowScan(read: KeytagRead, vehicles: Vehicle[]): OverflowScanResult | null {
  const { resolution, plate, vehicle } = resolveKeytagScan(read, vehicles);
  if (!plate) return null;

  if (resolution.kind === 'new') {
    const register = newVehicleToRegisterOnScan(read, vehicles); // NewVehicle | null (null = too partial)
    const unit = register?.unitNumber ?? read.unitNumber ?? null;
    return { send: { plate, unit, label: labelFor(unit, plate) }, register, backfill: null, unregistered: register === null };
  }

  const bf = backfillFieldsOnScan(read, vehicles); // partial → fills, else null
  const unit = vehicle?.unitNumber ?? null;
  return {
    send: { plate, unit, label: labelFor(unit, plate) },
    register: null,
    backfill: bf ? { vehicleId: bf.vehicleId, applies: bf.applies } : null,
    unregistered: false,
  };
}
