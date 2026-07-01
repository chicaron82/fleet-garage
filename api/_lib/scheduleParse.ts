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
 * The roster profiles a read name *could* be: an exact full-name hit (one — or several,
 * if the roster carries duplicate names) wins outright; otherwise everyone whose first
 * name (or a clean partial) matches. Shared basis for both a single-row match and the
 * cross-row elimination pass below.
 */
function candidatesFor(parsed: string, roster: RosterProfile[]): RosterProfile[] {
  const p = norm(parsed);
  if (!p) return [];
  const exact = roster.filter((r) => norm(r.name) === p);
  if (exact.length) return exact;
  const first = p.split(' ')[0];
  return roster.filter((r) => {
    const rn = norm(r.name);
    return rn === first || rn.startsWith(`${first} `) || rn.split(' ')[0] === first || rn.includes(p);
  });
}

/**
 * Match a name read off the grid to a roster profile. Exact full-name wins ('exact');
 * else a UNIQUE first-name / clean partial resolves ('partial'); anything ambiguous or
 * unmatched returns 'none' so the human assigns it in the preview. Never guesses among
 * collisions (two "Aaron"s → none).
 */
export function matchStaffName(parsed: string, roster: RosterProfile[]): NameMatch {
  const cands = candidatesFor(parsed, roster);
  if (cands.length !== 1) return { profileId: null, confidence: 'none' };
  const only = cands[0];
  return { profileId: only.id, confidence: norm(only.name) === norm(parsed) ? 'exact' : 'partial' };
}

/**
 * Match every parsed row to the roster (keeps row order), then run an elimination pass:
 * a name left ambiguous resolves if all but one of its candidates are already uniquely
 * claimed by other rows. That's a *deduction*, not a guess — a sheet with "Larry J"
 * (claims Larry J) plus a bare "LARRY" leaves only Larry C for the bare one. Claims are
 * taken as we go, so two ambiguous rows can never both grab the same leftover profile.
 */
export function matchSchedule(staff: ParsedStaffRow[], roster: RosterProfile[]): NameMatch[] {
  const results = staff.map((s) => matchStaffName(s.name, roster));
  const claimed = new Set(results.map((m) => m.profileId).filter((id): id is string => id !== null));
  results.forEach((m, i) => {
    if (m.profileId) return;
    const open = candidatesFor(staff[i].name, roster).filter((c) => !claimed.has(c.id));
    if (open.length === 1) {
      results[i] = { profileId: open[0].id, confidence: 'partial' };
      claimed.add(open[0].id);
    }
  });
  return results;
}
