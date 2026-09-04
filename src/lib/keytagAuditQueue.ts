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
 *  ⚠️⚠️ `keyCount` WAS EXCLUDED HERE AND THAT WAS TOO STRONG — reversed 2026-08-30. The old note
 *  read: *"a tag photo may happen to show keys and may just as easily not; asking him to confirm it
 *  from this photo asks him to certify something the evidence does not carry. Five cars are missing
 *  it, and they are missing it correctly."*
 *
 *  Aaron, auditing a fresh batch: *"some keytags have keys with them, is it possible to add the
 *  keycount to the ones that have a tag and are missing a keycount as part of the audit?"*
 *
 *  ⭐ He is right, and the flaw was mine: this card's own footer already says **"Nothing here is
 *  required — leave anything you can't read blank."** The whole surface is built on *fill what you
 *  can see*. I held one field to a stricter standard than the card itself does — treating "sometimes
 *  unanswerable" as "never askable" on a form where every field is already optional.
 *
 *  📊 And the number moved: five cars when that note was written, **55** after the 2026-08-30 batch
 *  fix landed 57 photos. So it is now the single largest gap the audit could close.
 *
 *  ⚠️ It stays CONDITIONAL — offered only when the car has no key count at all (see
 *  `auditKeyCountOffered`), never as a sixth field on all 642 cards. And it is never pre-filled from
 *  a model read: keys are counted by eye, off a ring, in a photo that may not show them.
 *
 *  ⚠️ Still excluded, and this one stands:
 *   • `licensePlate` — it is the MATCH KEY that found this record, and changing it is a re-plate,
 *     which `plateWrite` already owns with its own overwrite semantics and its own warning.
 *  See `KeytagRead` in api/_lib/keytagRead.ts: make and model are DERIVED from the class code, not
 *  printed, so they are not auditable off a tag either. */
export type AuditField = 'owningArea' | 'rentalClass' | 'classCode' | 'unitNumber' | 'vinLast9';

/**
 * Should this car's audit card offer a key count?
 *
 * ⚠️ ONLY WHEN IT HAS NONE. A car that already has a count is not asked again — the number came off
 * a ring in someone's hand, and re-asking from a photo invites a worse answer to overwrite a better
 * one. 55 of 642 tagged cars qualify today, so this keeps a sixth field off ~92% of cards.
 */
export function auditKeyCountOffered(v: { keyCount?: number | null }): boolean {
  return v.keyCount === null || v.keyCount === undefined;
}

/** Queue order within a car — the reading order on the tag itself (top line down), so his eye
 *  moves the same way every time and the form stops being a form. */
export const AUDIT_FIELDS: readonly AuditField[] = [
  'owningArea', 'rentalClass', 'classCode', 'unitNumber', 'vinLast9',
];

/** Human labels, kept beside the field list so a new field cannot ship without one.
 *
 *  ⭐⭐ "MODEL CODE", NOT "CLASS CODE" — Aaron, first sitting, after putting a rental class in the
 *  wrong box: *"both use 'class' that's why i asked. class code, should have been 'model code'."*
 *  The FVB4297 tag prints the heading `Class` above `E9`, and FG's field was called `Class code`, so
 *  the word pulled him straight to the wrong field. He had the domain exactly right — *"i know this
 *  class is an E9, because its a model y"* — and the label still sent it to the wrong column. That
 *  is a label doing damage, not an operator slip. The DB column stays `class_code`; only what a
 *  person reads changes. */
export const AUDIT_FIELD_LABELS: Readonly<Record<AuditField, string>> = {
  owningArea:  'Owning area',
  rentalClass: 'Rental class',
  classCode:   'Model code',
  unitNumber:  'Unit #',
  vinLast9:    'VIN (last 9)',
};

/**
 * What each value LOOKS like — deliberately not where it sits on the tag.
 *
 * ⚠️ POSITION IS A PROXY AND IT BREAKS ACROSS FORMATS. The first hint I offered was *"top line,
 * beside the branch number"*, which is true of the printed Hertz tag and **wrong on the very tag
 * that caused the mix-up**: FVB4297's is a labelled list (Own Area / Veh # / Lic # / Model /
 * Color-YR / Last9vin / Class) whose model is a NAME and which carries no model code at all.
 * Describing the value survives a format change; describing its location does not.
 */
export const AUDIT_FIELD_HINTS: Readonly<Record<AuditField, string>> = {
  owningArea:  'the branch number — 8199 is Winnipeg; a printed leading zero is dropped',
  rentalClass: 'the short size/type group — Q4, E9, P4',
  classCode:   'the 4-letter code (CRVB, CTMY) — not every tag has one; leave it blank if the model is spelled out',
  unitNumber:  'the Veh # — 7 digits, printed in two groups (574 7498)',
  vinLast9:    'the last 9 of the VIN — capped at 9, every stored VIN is exactly that',
};

/** A field whose value looks like it landed in the wrong box — said out loud, never enforced. */
export interface AuditWarning { field: AuditField; message: string; }

/**
 * The wrong-box guard.
 *
 * ⚠️⚠️ THERE IS NO SHAPE RULE HERE, AND THE FIRST DRAFT'S WAS THE BUG. It read *"a model code is 4
 * characters starting with C"* — true of 79 of the fleet's 79 codes, and still wrong, because
 * **not every tag carries a model code at all.** DEWN854 is handwritten and spells `SELTOS` out in
 * full; the US Compass says `COMPASS`; FVB4297 says `Model Y`. A shape rule warns him about tags he
 * has read perfectly, which is worse than the mistake it guards. Aaron killed it on sight.
 *
 * ⭐ So the check is MEMBERSHIP, not shape — and only in the two sets FG already holds. It fires on
 * exactly one thing: a value that is definitely the OTHER field's kind. A brand-new model code, a
 * spelled-out model name, an empty box — none of them trip anything, because none of them are a
 * known rental class.
 *
 * ⭐ And it warns, never blocks. He typed E9 from KNOWING the car rather than reading it
 * (*"because its covered up"*), and a rule that refuses a value he is certain of is worse than the
 * bug it prevents. E9 was never malformed — it is a perfectly good rental class that landed one
 * box down.
 */
export function auditWarnings(
  edits: Partial<Record<AuditField, string>>,
  /** Every rental class in use on the fleet. */
  knownRentalClasses: ReadonlySet<string>,
  /** Every model code in use, with the rental classes removed — see `useKeytagAudit`. A value that
   *  is both cannot accuse either field, so it is excluded rather than guessed at. */
  knownModelCodes: ReadonlySet<string>,
): AuditWarning[] {
  const out: AuditWarning[] = [];
  const model  = (edits.classCode   ?? '').trim().toUpperCase();
  const rental = (edits.rentalClass ?? '').trim().toUpperCase();

  if (model && knownRentalClasses.has(model) && !knownModelCodes.has(model)) {
    out.push({
      field: 'classCode',
      message: `“${model}” is a rental class — did it belong in the field above?`,
    });
  }
  if (rental && knownModelCodes.has(rental) && !knownRentalClasses.has(rental)) {
    out.push({
      field: 'rentalClass',
      message: `“${rental}” is a model code — the rental class is the short group (Q4, E9).`,
    });
  }
  return out;
}

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
 * The retake watchlist — cars whose stored photo needs replacing, for either reason.
 *
 * ⚠️ 'unreadable' (cannot read it) and 'stale' (can read it, wrong tag) are ONE list because they
 * are one errand: go to the car, take a photo. They stay two words because they are two different
 * things to expect when you get there. See KeytagAuditResult.
 *
 * ⭐ There is no `keytag_retake_watchlist` table. This IS the watchlist, and it is the same column
 * that advances the audit queue (migration 130): auditing and flagging are one gesture, so the list
 * cannot drift out of step with the audit. A fresh capture clears the result back to NULL, which
 * puts the car straight back in line for the audit it never got.
 */
export function retakeWatchlist<V extends AuditableVehicle>(vehicles: readonly V[]): V[] {
  return vehicles
    .filter(v => v.keytagAuditResult === 'unreadable' || v.keytagAuditResult === 'stale')
    .sort((a, b) => a.licensePlate.localeCompare(b.licensePlate));
}

/** Headline for the collapsed card: how much work is left and how much has been done. */
export interface AuditQueueStats {
  /** Cars with a photo that nobody has read yet. */
  pending: number;
  /** Cars a human has read and confirmed. */
  verified: number;
  /** Cars whose photo defeated him. */
  unreadable: number;
  /** Cars whose photo is legible but belongs to a tag the car no longer wears (migration 134).
   *  Counted apart from `unreadable` because the errand differs; both are on the retake list. */
  stale: number;
  /** Cars with no photo at all: not auditable, a capture backlog. */
  noPhoto: number;
  /** Total blank tag fields across the pending queue — what a full pass would recover. */
  gaps: number;
}

/**
 * ⭐⭐⭐ THE RECEIPT FOR A CAPTURE HE DID NOT COME HERE TO MAKE.
 *
 * Scanning a tag on ANY surface saves the photo when the car lacks one — the universal capture in
 * `useBackfillOnScan`. So a scan he ran to start a trip, or to write up the closing inventory,
 * quietly takes a car off the photo backlog **and tells him nothing.** That is precisely the kind of
 * fact the bougie-toasts ticket exists for: *celebrate what he did not know, never what he just did.*
 * He knows he scanned; he does not know it was that car's first tag.
 *
 * ⚠️ THE TICKET'S OWN EXAMPLE — *"that was the last car in R-4 without one"* — IS NOT COMPUTABLE.
 * FG does not store a lot row on a vehicle; `R-4` exists only inside a closing-inventory session.
 * The same SHAPE of fact is computable on a set FG really has: the photo backlog. So this delivers
 * the idea rather than the sentence, which is the honest version of granting the request.
 *
 * ⚠️ `remaining` must be counted with `isBlankField(keytagPhotoUrl)` — the SAME predicate
 * `auditQueueStats` uses for `noPhoto` — so this line and the audit card can never disagree about
 * how many are left. A second way of counting is a second answer.
 */
export function firstPhotoNote(remaining: number): string {
  return remaining <= 0
    ? '📷 first key tag photo — that was the last car without one'
    : `📷 first key tag photo — ${remaining} left without one`;
}

export function auditQueueStats(vehicles: readonly AuditableVehicle[]): AuditQueueStats {
  const stats: AuditQueueStats = { pending: 0, verified: 0, unreadable: 0, stale: 0, noPhoto: 0, gaps: 0 };
  for (const v of vehicles) {
    if (isBlankField(v.keytagPhotoUrl)) { stats.noPhoto++; continue; }
    if (v.keytagAuditResult === 'unreadable') { stats.unreadable++; continue; }
    if (v.keytagAuditResult === 'stale') { stats.stale++; continue; }
    if (!isBlankField(v.keytagAuditedAt)) { stats.verified++; continue; }
    stats.pending++;
    stats.gaps += missingTagFields(v).length;
  }
  return stats;
}
