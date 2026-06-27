// Shapes + pure helpers for the schedule-photo import (Phase 1: parse + preview, no
// write). The proxy's vision call fills a ParsedSchedule via a forced tool; the client
// renders it as a verify grid and matches each read name to a roster profile. Kept here
// (pure, tested) so the grid contract is one source of truth the client imports.

export type ParsedShiftType = 'opening' | 'mid' | 'closing' | 'day-off' | 'pto' | 'sick' | 'unknown';

/** One cell of the grid — a person's shift on a day, as read off the photo. */
export interface ParsedCell {
  day: string; // the column label as seen ("Mon", "Jul 3", a date)
  type: ParsedShiftType; // the model's best mapping to an FG shift type
  raw: string; // the raw cell content the model read (source of truth for the human)
}

export interface ParsedStaffRow {
  name: string; // the name as read off the grid row
  cells: ParsedCell[];
}

export interface ParsedSchedule {
  weekStart: string | null; // start date if the photo shows one (ISO or as-seen)
  staff: ParsedStaffRow[];
}

// ── Name matching (the "plate recognition" analogue) ────────────────────────────

export interface RosterProfile {
  id: string;
  name: string;
}

export type MatchConfidence = 'exact' | 'partial' | 'none';

export interface NameMatch {
  profileId: string | null;
  confidence: MatchConfidence;
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Match a name read off the grid to a roster profile. Exact full-name wins; else a
 * UNIQUE first-name (or clean partial) match is offered as 'partial'; anything ambiguous
 * or unmatched returns 'none' so the human assigns it in the preview. Never guesses among
 * collisions (two "Aaron"s → none).
 */
export function matchStaffName(parsed: string, roster: RosterProfile[]): NameMatch {
  const p = norm(parsed);
  if (!p) return { profileId: null, confidence: 'none' };

  const exact = roster.filter((r) => norm(r.name) === p);
  if (exact.length === 1) return { profileId: exact[0].id, confidence: 'exact' };
  if (exact.length > 1) return { profileId: null, confidence: 'none' }; // duplicate names → human picks

  const first = p.split(' ')[0];
  const candidates = roster.filter((r) => {
    const rn = norm(r.name);
    return rn === first || rn.startsWith(`${first} `) || rn.split(' ')[0] === first || rn.includes(p);
  });
  if (candidates.length === 1) return { profileId: candidates[0].id, confidence: 'partial' };
  return { profileId: null, confidence: 'none' };
}

/** Match every parsed row to the roster (keeps row order). */
export function matchSchedule(staff: ParsedStaffRow[], roster: RosterProfile[]): NameMatch[] {
  return staff.map((s) => matchStaffName(s.name, roster));
}
