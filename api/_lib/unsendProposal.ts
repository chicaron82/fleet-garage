// Removing a logged send that never actually happened.
//
// ⭐ WHY THIS EXISTS (Aaron, 2026-09-01). His boss picked five cars for FastAir; he captured five
// key tags and logged them through Effie. A driver then ignored the note on the board and took
// different cars — two went to the airport, and a third sat at Erin St until FastAir filled up
// and it was re-sent to AV Flight. Three of five rows recorded a send that never occurred, and
// the only way to fix the record was *"to ask you or hunt for it myself in supabase."*
//
// His requirement, and the whole design in one line: *"I just need to know what was actually
// sent. not what planned on getting sent but then didn't."*
//
// ⚠️ A VOID IS NOT A DELETE, AND THAT IS INVISIBLE TO HIM ON PURPOSE. Every read filters
// `voided_at IS NULL` (migration 135), so a voided send is simply gone from every manifest, count
// and report — exactly what he asked for. The row survives only in the database, so a mis-tap
// from a phone in a washbay is recoverable and so the correction is not itself lost.
//
// ⚠️⚠️ AND IT NEVER RESOLVES AN AMBIGUOUS TARGET. Voiding the wrong row would put a lie in the
// record while looking like a fix — the same failure it exists to undo. Two matches means ASK,
// never pick. See `pickUnsendTarget`.

/** One logged send that could be the thing he means. */
export interface SentCandidate {
  /** `vsa_trips.id` — the only thing the write is scoped by. */
  id: string;
  plate: string;
  unit: string | null;
  destination: string;
  /** Business day, YYYY-MM-DD. */
  day: string;
  /** Local 24h clock — "11:33". The disambiguator when a car went twice in one day. */
  time: string;
}

/** A send the operator is being asked to confirm removing. */
export interface UnsendProposal {
  kind: 'unsend';
  trip: SentCandidate;
  /** His own words for why it did not go. Optional — the record is better with it, not invalid without. */
  reason?: string;
}

export type UnsendTarget =
  | { ok: true; trip: SentCandidate }
  | { ok: false; why: 'none' }
  | { ok: false; why: 'ambiguous'; candidates: SentCandidate[] };

/**
 * Choose the send to void — or refuse to.
 *
 * ⚠️ THE REFUSAL IS THE FEATURE. With one match this is trivial; with several the tempting move is
 * "take the most recent", which is wrong in the exact case that matters: a car sent to FastAir in
 * the morning and AV Flight in the afternoon is precisely the shape that produced this whole
 * ticket, and the row he wants gone is the EARLIER one. A wrong void looks identical to a right
 * one afterwards — nothing surfaces it — so the only safe behaviour is to hand the choice back.
 */
export function pickUnsendTarget(candidates: readonly SentCandidate[]): UnsendTarget {
  if (candidates.length === 0) return { ok: false, why: 'none' };
  if (candidates.length === 1) return { ok: true, trip: candidates[0] };
  return { ok: false, why: 'ambiguous', candidates: [...candidates] };
}

/** Build the proposal. Pure — no I/O, no write. */
export function buildUnsendProposal(trip: SentCandidate, reason?: string): UnsendProposal {
  const r = (reason ?? '').trim();
  return r ? { kind: 'unsend', trip, reason: r } : { kind: 'unsend', trip };
}

/** A short one-liner the AI/tool can echo back. */
export function describeUnsendProposal(p: UnsendProposal): string {
  return `remove ${p.trip.plate}'s send to ${p.trip.destination} on ${p.trip.day} at ${p.trip.time}`;
}

/** One candidate as a line the operator can choose from — plate, spot, day and time. */
export function describeCandidate(c: SentCandidate): string {
  return `${c.plate} → ${c.destination} · ${c.day} ${c.time}`;
}
