// Graceful degradation for a key-tag scan whose CLASS CODE isn't in the codex yet.
//
// The bug this kills (found live, LUR437 "CDGT 26 BLA 4DR", 2026-07-19): the codex knew CDR8
// (older Durango) but not CDGT, so make/model came back empty, `newVehicleFromRead` returned
// null, and the scan-router offered nothing but Lost & Found — on a car Aaron was holding for
// PM. The tag had given FG FOUR of six fields (plate, unit#, year, colour) and every one of them
// was thrown away because two couldn't be resolved.
//
// The principle: a lookup miss should DEGRADE what a feature offers, never delete the feature.
// "I don't know one field" is not "I know nothing" — and since the codex will always lag a live
// fleet, the incomplete read is the NORMAL case, not the edge case. Nothing here guesses a make
// or model (the codex's no-guessing rule stands); it just refuses to discard what was read.
import type { KeytagRead } from '../../api/_lib/keytagRead';
import { normalizeClassCode } from '../../api/_lib/vehicleClassCodex';
import type { ScannedIdentity } from '../types';

/** Everything the tag actually gave us, blanks where it didn't — never null-on-incomplete.
 *  Feeds the register form's prefill so the operator types only what's genuinely missing. */
export function scannedFromRead(read: KeytagRead, plate: string): ScannedIdentity {
  return {
    unitNumber: read.unitNumber ?? '',
    plate,
    make:  read.make  ?? '',
    model: read.model ?? '',
    year:  read.year  ?? 0,
    color: read.color ?? '',
    rentalClass: read.rentalClass ?? '',
    rentalClassInferred: read.rentalClassInferred,
    isHybrid: read.isHybrid ?? false,
    // ⚠️ TWO SEPARATE FIELDS, and conflating them lost data for a day (2026-08-21).
    //   `classCode`      — what the tag SAID, always. It is stored on the vehicle so the record's
    //                      identity stays checkable against what produced it (migration 120).
    //   `teachClassCode` — only when the codex MISSED, i.e. "registering this also teaches FG".
    // The register form used to seed its field from `teachClassCode` alone, so a code the codex
    // already knew (CALE → GMC Acadia) was resolved into a make and model and then DISCARDED:
    // exactly backwards, since the known codes are the ones we can trust most.
    classCode: normalizeClassCode(read.classCode) || undefined,
    teachClassCode: isUnknownClassCode(read) ? normalizeClassCode(read.classCode) : undefined,
  };
}

/** Enough to be worth offering a pre-filled registration even though the class code missed.
 *  Plate + unit# are FG's two identity keys — with both, the operator is adding make/model to a
 *  real car rather than typing a record from scratch. */
export function canRegisterPartially(read: KeytagRead, plate: string): boolean {
  return !!plate && !!read.unitNumber?.trim();
}

/** The tag printed a class code and the codex couldn't resolve it — the signal worth surfacing
 *  to the operator ("here's WHY it won't register") and logging so codes self-report. */
export function isUnknownClassCode(read: KeytagRead): boolean {
  return !!read.classCode?.trim() && !read.make;
}
