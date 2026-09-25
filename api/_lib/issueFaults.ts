// Faults as rows (migration 150): a machine can be down for more than one reason at once.
//
// ⭐ Aaron, 2026-09-24, hours after the auto wash's rinse pipe snapped: *"there's also another issue
// for the auto wash. The wheel brush on the passenger side isn't spinning. That one has been non
// functional for a month now."* One record with one status could not say "two faults, one fixed,
// one still down". The machine is the record; each thing wrong with it is a fault with its own note,
// photo, start and Clear. docs/September/ticket-faults-as-rows.md
//
// Lives under api/_lib so Effie (a Vercel function, which cannot import src/) and the app read the
// SAME rule — the tagColour arrangement.

/** One thing wrong with a machine. */
export interface IssueFault {
  id: string;
  issueId: string;
  /** What broke — required when a fault is opened. */
  note: string;
  photoUrl?: string;
  openedAt: string;
  openedBy: string;
  clearedAt?: string;
}

/** An `issue_faults` row as the database returns it. */
export interface IssueFaultRow {
  id: string;
  issue_id: string;
  note: string;
  photo_url: string | null;
  opened_at: string;
  opened_by: string;
  cleared_at: string | null;
}

export function faultFromRow(r: IssueFaultRow): IssueFault {
  return {
    id: r.id, issueId: r.issue_id, note: r.note, openedAt: r.opened_at, openedBy: r.opened_by,
    ...(r.photo_url ? { photoUrl: r.photo_url } : {}),
    ...(r.cleared_at ? { clearedAt: r.cleared_at } : {}),
  };
}

/** Each machine's OPEN faults, oldest first — the order he'd triage them in, and the card shows. */
export function openFaultsByIssue(rows: readonly IssueFaultRow[]): Map<string, IssueFault[]> {
  const out = new Map<string, IssueFault[]>();
  for (const r of rows) {
    if (r.cleared_at) continue;
    const list = out.get(r.issue_id) ?? [];
    list.push(faultFromRow(r));
    out.set(r.issue_id, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  return out;
}

/** When the machine has been down since — its OLDEST open fault. Undefined with none open. */
export function downSince(faults: readonly IssueFault[]): string | undefined {
  return faults.reduce<string | undefined>((min, f) => (!min || f.openedAt < min ? f.openedAt : min), undefined);
}

/** One line of what's wrong, for Effie: "Rinse pipe snapped; passenger wheel brush not spinning". */
export function faultsSummary(faults: readonly IssueFault[]): string {
  return faults.map(f => f.note.trim()).filter(Boolean).join('; ');
}
