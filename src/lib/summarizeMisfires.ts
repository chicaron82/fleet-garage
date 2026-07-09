// The "where Effie misfires" derivation (docs/ticket-misc-effie-correction-loop.md):
// takes the reason ids of rejected staged writes and groups them into the pattern worth
// acting on. Splits true READ misfires (a class code, a prefix, a detail — each points at
// a tuning lever) from non-misread rejects (duplicate / not needed — valid, but nothing to
// tune). Pure so the surface stays a thin renderer and the grouping is tested in one place.
import { REJECT_REASONS, rejectReason } from './rejectReasons';

export interface MisfireGroup {
  id: string;
  label: string;
  count: number;
  /** The tuning lever this misfire points at (class codex / plate prefix / …). */
  tunes: string;
}

export interface OtherRejectGroup {
  id: string;
  label: string;
  count: number;
}

export interface MisfireSummary {
  /** Read errors worth tuning, most-frequent first. */
  misfires: MisfireGroup[];
  /** Valid rejects that aren't misreads (duplicate / not needed), most-frequent first. */
  other: OtherRejectGroup[];
  /** Total read-misfire rejects (sum of misfires' counts) — the headline number. */
  misfireTotal: number;
}

/** Group rejected-write reason ids into misfire vs non-misfire tallies. Unknown/legacy
 *  ids (not in REJECT_REASONS) are ignored — a drifted value isn't a tunable signal. */
export function summarizeMisfires(reasonIds: string[]): MisfireSummary {
  const counts = new Map<string, number>();
  for (const id of reasonIds) {
    if (rejectReason(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const misfires: MisfireGroup[] = [];
  const other: OtherRejectGroup[] = [];
  // Iterate REJECT_REASONS (not the map) so ties resolve to the canonical reason order.
  for (const r of REJECT_REASONS) {
    const count = counts.get(r.id);
    if (!count) continue;
    if (r.misfire) misfires.push({ id: r.id, label: r.label, count, tunes: r.tunes });
    else other.push({ id: r.id, label: r.label, count });
  }
  misfires.sort((a, b) => b.count - a.count);
  other.sort((a, b) => b.count - a.count);

  return { misfires, other, misfireTotal: misfires.reduce((n, m) => n + m.count, 0) };
}
