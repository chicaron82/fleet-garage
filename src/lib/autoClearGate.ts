// Graduated autonomy L2 — the auto-clear gate (docs/ticket-misc-effie-graduated-autonomy.md).
// Decides whether a staged write is trustworthy enough to clear WITHOUT an operator tap. This is
// the DETERMINISTIC half — the part that needs no accrued data and runs in SHADOW mode today
// (verdict recorded, nothing fires). The LIVE gate will additionally require a low measured misfire
// rate from the correction-loop data (deferred until that data accrues); layered so the flip is a
// one-line `&& misfireRateOk` on top of this.
//
// Aaron's risk line (2026-07-09): BACKFILLS ONLY. A backfill (update_vehicle) is safe by structure
// (blanks-only, conflicts excluded upstream) AND — for auto-clear — needs a clean READ: the plate
// must not have needed an MB-prefix correction (a corrected plate is a lower-confidence read).
// Registers are never eligible (their safety needs read-confidence we don't gate on yet); holds
// NEVER auto-clear, no matter the signals.
import type { Proposal } from '../../api/_lib/holdProposal';

/** The deterministic read-quality signals the gate weighs. Computed at scan time (they're not on
 *  the stored proposal), so the producer evaluates and records the verdict. */
export interface AutoClearSignals {
  /** The keytag plate needed an MB-prefix correction — a lower-confidence read. */
  plateCorrected: boolean;
}

/** True iff the deterministic gate would auto-clear this write. Backfill kind + a clean plate read.
 *  Never true for a register or a hold. The LIVE gate ANDs a misfire-rate check onto this. */
export function passesDeterministicAutoClear(proposal: Proposal, signals: AutoClearSignals): boolean {
  if (proposal.kind !== 'update_vehicle') return false;
  return !signals.plateCorrected;
}
