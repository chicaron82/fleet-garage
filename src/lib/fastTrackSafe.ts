// Graduated autonomy, level 1 — "fast-track" (docs/ticket-misc-effie-graduated-autonomy.md).
// The operator still taps, but the queue flags which staged writes are safe to clear in one
// bulk pass vs which need their eyes. This is the "earned safe set" — the policy seam.
//
// Aaron's risk line (2026-07-09): fast-track backfills ONLY. A backfill (update_vehicle) is safe
// by STRUCTURE, not by a confidence guess — it fills blank fields only, conflicts are excluded
// upstream by resolveKeytag, and it's reversible. So it qualifies on kind alone, with no stored
// read-confidence signal. A register's safety depends on read confidence we don't store yet, so
// it is NOT fast-track-safe; a hold ALWAYS waits for eyes, no matter the confidence. Widen this
// set deliberately (and never to holds) as trust is earned from the misfire data.
import type { Proposal } from '../../api/_lib/holdProposal';

export function isFastTrackSafe(proposal: Proposal): boolean {
  return proposal.kind === 'update_vehicle';
}
