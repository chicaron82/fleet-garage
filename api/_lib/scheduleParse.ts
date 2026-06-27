// Shapes + pure helpers for the schedule-photo import (Phase 1: parse + preview, no
// write). The proxy's vision call fills a ParsedSchedule via a forced tool; the client
// renders it as a verify grid and matches each read name to a roster profile. Kept here
// (pure, tested) so the grid contract is one source of truth the client imports.

export type ParsedShiftType = 'opening' | 'mid' | 'closing' | 'day-off' | 'pto' | 'sick' | 'unknown';

/** One cell of the grid — a person's shift on a specific dated day, read off the photo. */
export interface ParsedCell {
  date: string | null; // resolved ISO date (YYYY-MM-DD) for this cell, or null if unresolvable
  type: ParsedShiftType; // derived classification (drives the shift_type field + colour)
  startTime: string | null; // 24h "HH:MM" as printed, or null for off/vacation
  endTime: string | null;
  raw: string; // exactly what was printed (source of truth for the human)
}

export interface ParsedStaffRow {
  name: string; // the name as read off the grid row (role markers like "(PT)" stripped)
  cells: ParsedCell[]; // one per dated column; for a multi-week sheet, all weeks merged
}

export interface ParsedSchedule {
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

// Strip role markers like "(PT)" and collapse whitespace, so "CJ (PT)" matches "CJ".
const norm = (s: string): string => s.trim().toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

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
