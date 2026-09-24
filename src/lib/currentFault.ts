/** One line of a machine's fault trail, as `issue_events` stores it. */
export interface FaultEvent {
  /** The event's own id — present when a WRITE needs to target it (attaching a photo). */
  id?: string;
  issueId: string;
  eventType: string;
  note?: string | null;
  createdAt: string;
  /** A photo of THIS event's fault (migration 149). */
  photoUrl?: string | null;
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
  return new Map([...currentFaultEvents(events)].map(([id, e]) => [id, e.note!.trim()]));
}

/**
 * The photo of what is wrong NOW — read off the SAME event `currentFaultByIssue` picks, so the card's
 * picture and its "Now:" line can never describe two different breakdowns (migration 149).
 *
 * ⚠️ When the current fault has no photo, the machine has NO current photo — never an older fault's.
 * June's E-stop picture under September's "rinse pipe snapped" would be a confident, wrong image.
 * docs/September/ticket-a-photo-per-fault.md
 */
export function currentPhotoByIssue(events: readonly FaultEvent[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, e] of currentFaultEvents(events)) {
    const url = e.photoUrl?.trim();
    if (url) out.set(id, url);
  }
  return out;
}

/** The one choice both functions above share: per machine, the newest reopen that SAYS something.
 *  Exported so a WRITE can target the same event the card reads (attaching a photo to the fault). */
export function currentFaultEvents(events: readonly FaultEvent[]): Map<string, FaultEvent> {
  const newest = new Map<string, FaultEvent>();
  for (const e of events) {
    if (e.eventType !== 'reopened') continue;
    const note = e.note?.trim();
    if (!note) continue;                       // a blank reopen says nothing — the old ones are blank
    const held = newest.get(e.issueId);
    if (!held || e.createdAt > held.createdAt) newest.set(e.issueId, e);
  }
  return newest;
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
