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
  /** Who wrote the event — for a reopen, who reopened the machine. */
  userId?: string | null;
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
  const out = new Map<string, string>();
  for (const [id, e] of currentFaultEvents(events)) {
    const note = e.note?.trim();
    if (note) out.set(id, note);             // a blank spell = cause not recorded — never an older fault
  }
  return out;
}

/**
 * When the machine's CURRENT down spell began, and who reopened it — the day counter's start.
 * Aaron, 2026-09-24: *"should it reset the day counter. currently reads like its Day 108, and its
 * still down"* — counted from the FIRST report, the auto wash read 108 days down for a pipe that
 * snapped that afternoon. No entry = never reopened: the counter stays on the first report.
 */
export function currentSpellByIssue(events: readonly FaultEvent[]): Map<string, { at: string; by?: string }> {
  const out = new Map<string, { at: string; by?: string }>();
  for (const [id, e] of currentFaultEvents(events)) {
    out.set(id, e.userId ? { at: e.createdAt, by: e.userId } : { at: e.createdAt });
  }
  return out;
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

/**
 * The one choice every function above shares: per machine, its NEWEST reopen — the start of the down
 * spell it is in now. Exported so a WRITE can target the same event the card reads (a photo).
 *
 * ⚠️⚠️ CORRECTED 2026-09-24 (ticket-the-current-spell). This used to pick "the newest reopen that
 * SAYS something" and skip blank ones — which resurrected FIXED faults: the mat machine was reopened
 * May 6 "tripping breaker", resolved May 8 "Fixed", reopened Aug 4 with no note, and the card said
 * "Now: tripping breaker". A machine must be cleared before it can be reopened, so the newest reopen
 * is ALWAYS the current spell; an older note belongs to a spell that already ended.
 */
export function currentFaultEvents(events: readonly FaultEvent[]): Map<string, FaultEvent> {
  const newest = new Map<string, FaultEvent>();
  for (const e of events) {
    if (e.eventType !== 'reopened') continue;
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
  issue: { description?: string; status: string; reopenedAt?: string },
  current: string | undefined,
): string | null {
  if (issue.status === 'resolved') return null;
  // ⚠️ A reopened spell with no note says nothing — never the FIRST fault, which is a problem that
  // was already fixed, dressed as today's (ticket-the-current-spell).
  if (issue.reopenedAt) return current?.trim() || null;
  return (current ?? issue.description ?? '').trim() || null;
}
