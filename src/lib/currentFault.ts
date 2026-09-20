/** One line of a machine's fault trail, as `issue_events` stores it. */
export interface FaultEvent {
  issueId: string;
  eventType: string;
  note?: string | null;
  createdAt: string;
}

/**
 * What is wrong with each machine RIGHT NOW — the newest reopen note, per issue.
 *
 * ⭐⭐ Aaron, 2026-09-20: *"instead of having a second mat machine issue for it eating mats, we'd
 * just rename the record as mat machine, and what's currently wrong with it this time."* The machine
 * is the record; the fault is what is true about it today. That is the vehicle/holds shape applied
 * to equipment, and it needs the reopen to SAY what broke — which is why the note became required
 * in the same change.
 *
 * ⚠️⚠️ `description` IS NEVER OVERWRITTEN, and this function is why it doesn't have to be. The first
 * fault stays the first fault; the current one is DERIVED from the trail. A field rewritten on every
 * reopen is a field that quietly loses the history this whole change exists to keep — and FG has
 * been bitten by exactly that shape before (a stored value read back as if it were the live rule).
 *
 * ⚠️ Only `reopened` events count. An `opened` note is the first fault (already in `description`)
 * and a `resolved` note says how it was FIXED — *"Replaced gun handle"*, *"E-stop was pressed.
 * Reset"* — which is the opposite of what is wrong now.
 */
export function currentFaultByIssue(events: readonly FaultEvent[]): Map<string, string> {
  const newest = new Map<string, FaultEvent>();
  for (const e of events) {
    if (e.eventType !== 'reopened') continue;
    const note = e.note?.trim();
    if (!note) continue;                       // a blank reopen says nothing — the old ones are blank
    const held = newest.get(e.issueId);
    if (!held || e.createdAt > held.createdAt) newest.set(e.issueId, e);
  }
  return new Map([...newest].map(([id, e]) => [id, e.note!.trim()]));
}

/**
 * The fault to show on the card: what broke most recently, or the original if it only ever broke once.
 *
 * ⚠️ A RESOLVED machine has no current fault — it is not down, and printing the last thing that was
 * wrong with it as though it still were is the kind of confident-and-stale line FG exists to remove.
 */
export function faultLine(
  issue: { description?: string; status: string },
  current: string | undefined,
): string | null {
  if (issue.status === 'resolved') return null;
  return (current ?? issue.description ?? '').trim() || null;
}
