// The reasons an operator can tag when rejecting a staged Effie write — the
// correction-loop signal (docs/ticket-misc-effie-correction-loop.md). Stored as free
// text in effie_pending_writes.reject_reason (migration 093); this const is the source
// of truth for the set, so it can grow without a migration.
//
// The load-bearing distinction: a "misfire" is a READ error worth tuning (a class code,
// a plate prefix, a wrong detail). A duplicate or a not-needed reject is NOT a misfire —
// the read was fine, the operator just didn't want the write. The surface only counts the
// misfires as things to fix; the rest are noise it can set aside.

export interface RejectReason {
  id: string;
  label: string;
  /** True = a read error worth tuning; false = a valid reject that isn't a misread. */
  misfire: boolean;
  /** What tuning lever a misfire points at (for the surface). Empty for non-misfires. */
  tunes: string;
}

export const REJECT_REASONS: RejectReason[] = [
  { id: 'wrong_class_code', label: 'Wrong class code', misfire: true,  tunes: 'class codex' },
  { id: 'wrong_plate',      label: 'Wrong plate',      misfire: true,  tunes: 'plate prefix' },
  { id: 'wrong_details',    label: 'Wrong details',    misfire: true,  tunes: 'read/prompt' },
  { id: 'duplicate',        label: 'Duplicate',        misfire: false, tunes: '' },
  { id: 'not_needed',       label: 'Not needed',       misfire: false, tunes: '' },
];

const BY_ID = new Map(REJECT_REASONS.map((r) => [r.id, r]));

/** Look up a reason by its stored id — undefined for an unknown/legacy value. */
export function rejectReason(id: string | null | undefined): RejectReason | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Human label for a stored reason id, falling back to the raw value (never blank for a
 *  set value) so a legacy/unknown id still renders something honest. */
export function rejectReasonLabel(id: string | null | undefined): string {
  if (!id) return '';
  return BY_ID.get(id)?.label ?? id;
}
