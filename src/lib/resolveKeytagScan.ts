// One step up from resolveKeytag: given a raw key-tag read and the fleet, normalize the
// plate (correctManitobaPrefix — the misread-prefix safety net), match it to a fleet
// vehicle, and resolve to new / complete / partial. Pure — the fleet is passed in; the
// caller (<KeytagScan>) renders the branch and stages the register/backfill.
// See docs/ticket-misc-effie-keytag-scan.md.
import { correctManitobaPrefix } from '../../api/_lib/platePrefix';
import { resolveKeytag, type KeytagResolution } from './resolveKeytag';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../types';

export interface KeytagScanResult {
  /** Exactly what the tag read (pre-normalize) — shown when the prefix was corrected. */
  rawPlate: string | undefined;
  /** Normalized + MB-prefix-corrected plate — the match key and what fills the field. */
  plate: string;
  /** The MB-prefix snap changed the read → show-your-work before offering to register. */
  wasCorrected: boolean;
  /** The matched fleet vehicle, or null = not in the fleet (new). */
  vehicle: Vehicle | null;
  /** new | complete | partial (with fills/conflicts) — from resolveKeytag. */
  resolution: KeytagResolution;
}

export function resolveKeytagScan(read: KeytagRead, vehicles: Vehicle[]): KeytagScanResult {
  const raw = (read.plate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const plate = correctManitobaPrefix(read.plate ?? '');
  const vehicle = plate
    ? vehicles.find(v => v.licensePlate.trim().toUpperCase() === plate) ?? null
    : null;
  const existing = vehicle
    ? { unitNumber: vehicle.unitNumber, make: vehicle.make, model: vehicle.model, year: vehicle.year, color: vehicle.color }
    : null;
  return {
    rawPlate: read.plate,
    plate,
    wasCorrected: plate !== raw,
    vehicle,
    resolution: resolveKeytag(read, existing),
  };
}
