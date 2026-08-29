// The key-tag audit queue — which car he looks at next, and what is missing off its tag.
//
// ⭐ WHY A PERSON AND NOT A MODEL. FG's identity gaps (290 cars with no owning area, 155 with no
// VIN) were framed for a whole day as a re-read problem: the data is in the stored photos, so it
// costs API money and has to be sized and scheduled. Every sentence of that was true and every one
// assumed a MODEL had to do the reading. Aaron reading the photo costs nothing, is more accurate
// than two models arguing over a watermark, and fits the gaps he already has between cars.
//
// Pure: no DB, no React, no fetch. The caller hands in the fleet it already holds.
import type { KeytagAuditResult } from '../types';
export type { KeytagAuditResult };

/** The fields actually PRINTED on a Hertz key tag, and therefore the only ones a person can
 *  confirm from a photo of one.
 *
 *  ⚠️ Deliberately excludes two fields the ticket's gap table listed:
 *   • `keyCount` — counted at the car, off the ring. A tag photo may happen to show keys and may
 *     just as easily not; asking him to confirm it from this photo asks him to certify something
 *     the evidence does not carry. Five cars are missing it, and they are missing it correctly.
 *   • `licensePlate` — it is the MATCH KEY that found this record, and changing it is a re-plate,
 *     which `plateWrite` already owns with its own overwrite semantics and its own warning.
 *  See `KeytagRead` in api/_lib/keytagRead.ts: make and model are DERIVED from the class code, not
 *  printed, so they are not auditable off a tag either. */
export type AuditField = 'owningArea' | 'rentalClass' | 'classCode' | 'unitNumber' | 'vinLast9';

/** Queue order within a car — the reading order on the tag itself (top line down), so his eye
 *  moves the same way every time and the form stops being a form. */
export const AUDIT_FIELDS: readonly AuditField[] = [
  'owningArea', 'rentalClass', 'classCode', 'unitNumber', 'vinLast9',
];

/** Human labels, kept beside the field list so a new field cannot ship without one. */
export const AUDIT_FIELD_LABELS: Readonly<Record<AuditField, string>> = {
  owningArea:  'Owning area',
  rentalClass: 'Rental class',
  classCode:   'Class code',
  unitNumber:  'Unit #',
  vinLast9:    'VIN (last 9)',
};

/** The narrow shape the queue needs — a subset of Vehicle, so this module stays decoupled from
 *  the full row type (same reasoning as `KeytagExistingVehicle` in resolveKeytag.ts). */
export interface AuditableVehicle {
  id: string;
  licensePlate: string;
  keytagPhotoUrl?: string | null;
  keytagAuditedAt?: string | null;
  keytagAuditResult?: KeytagAuditResult | null;
  owningArea?: string | null;
  rentalClass?: string | null;
  classCode?: string | null;
  unitNumber?: string | null;
  vinLast9?: string | null;
}

/** One car in the queue, with the gaps that put it there. */
export interface AuditCandidate<V extends AuditableVehicle = AuditableVehicle> {
  vehicle: V;
  /** Which tag fields this record currently has nothing for. May be empty — see buildAuditQueue. */
  missing: AuditField[];
}

/** Blank = null, undefined, or whitespace. There is no numeric field here, so unlike
 *  resolveKeytag's `isBlank` there is no zero-sentinel case to handle. */
export function isBlankField(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === '';
}

/** The tag fields this record has no value for. */
export function missingTagFields(v: AuditableVehicle): AuditField[] {
  return AUDIT_FIELDS.filter(f => isBlankField(v[f]));
}

/** A car belongs in the queue when there is a photo to read and nobody has read it yet.
 *
 *  ⚠️ A car with NO stored photo is not auditable — there is nothing to look at. Those 137 cars are
 *  a first-capture backlog, a different job, and putting them in this queue would serve him a blank
 *  screen and ask him to confirm it. */
export function isAuditable(v: AuditableVehicle): boolean {
  return !isBlankField(v.keytagPhotoUrl) && isBlankField(v.keytagAuditedAt);
}

/**
 * The queue, most-missing first (Aaron's call, 2026-08-28), so early sessions pay down the most
 * ground per tap.
 *
 * ⭐ A CAR WITH NOTHING MISSING STAYS IN THE QUEUE, at the back. Confirming a field is not a no-op:
 * it moves that field's provenance from 'tag' (a model read it) to 'manual' (a human checked it
 * against the artifact), and `resolveKeytag` treats 'manual' as locked — so a verified record is
 * immune to every later misread. Filling blanks is the visible win; hardening the values already
 * there is the larger one, and it only happens if those cars are still in the line.
 *
 * Ties break on plate so the order is stable across reloads — he should never be handed a queue
 * that reshuffles itself while he is working it.
 */
export function buildAuditQueue<V extends AuditableVehicle>(vehicles: readonly V[]): AuditCandidate<V>[] {
  const out: AuditCandidate<V>[] = [];
  for (const vehicle of vehicles) {
    if (!isAuditable(vehicle)) continue;
    out.push({ vehicle, missing: missingTagFields(vehicle) });
  }
  out.sort((a, b) =>
    b.missing.length - a.missing.length ||
    a.vehicle.licensePlate.localeCompare(b.vehicle.licensePlate));
  return out;
}

/**
 * The retake watchlist — cars whose stored photo a human could not read.
 *
 * ⭐ There is no `keytag_retake_watchlist` table. This IS the watchlist, and it is the same column
 * that advances the audit queue (migration 130): auditing and flagging are one gesture, so the list
 * cannot drift out of step with the audit. A fresh capture clears the result back to NULL, which
 * puts the car straight back in line for the audit it never got.
 */
export function retakeWatchlist<V extends AuditableVehicle>(vehicles: readonly V[]): V[] {
  return vehicles
    .filter(v => v.keytagAuditResult === 'unreadable')
    .sort((a, b) => a.licensePlate.localeCompare(b.licensePlate));
}

/** Headline for the collapsed card: how much work is left and how much has been done. */
export interface AuditQueueStats {
  /** Cars with a photo that nobody has read yet. */
  pending: number;
  /** Cars a human has read and confirmed. */
  verified: number;
  /** Cars whose photo defeated him — the retake list. */
  unreadable: number;
  /** Cars with no photo at all: not auditable, a capture backlog. */
  noPhoto: number;
  /** Total blank tag fields across the pending queue — what a full pass would recover. */
  gaps: number;
}

export function auditQueueStats(vehicles: readonly AuditableVehicle[]): AuditQueueStats {
  const stats: AuditQueueStats = { pending: 0, verified: 0, unreadable: 0, noPhoto: 0, gaps: 0 };
  for (const v of vehicles) {
    if (isBlankField(v.keytagPhotoUrl)) { stats.noPhoto++; continue; }
    if (v.keytagAuditResult === 'unreadable') { stats.unreadable++; continue; }
    if (!isBlankField(v.keytagAuditedAt)) { stats.verified++; continue; }
    stats.pending++;
    stats.gaps += missingTagFields(v).length;
  }
  return stats;
}
