// Lot Lookout crew, the database side for api/lot.ts: read today's roster (shifts + profiles) and his marks
// (lot_crew), and write a mark. The rules are pure in lotCrew.ts. Service role only: lot_crew is shut to the
// browser (migration 154), and profiles' names are never SENT to a caller who isn't signed in to FG.
import type { SupabaseClient } from '@supabase/supabase-js';
import { crewOf, crewSummary, stateFits, type CrewMark, type CrewMember, type CrewState, type CrewSummary, type RosterRow } from './lotCrew.js';
import { shiftBusinessDate } from './shiftDay.js';

export interface CrewPayload {
  summary: CrewSummary;
  /** The last time he changed anything today, for "as of". */
  changedAt: string | null;
  /** Names: only for a signed-in FG session. */
  members?: CrewMember[];
}

async function loadMembers(db: SupabaseClient, nowMs: number): Promise<{ members: CrewMember[]; marks: CrewMark[] }> {
  const day = shiftBusinessDate(new Date(nowMs));
  const { data: shifts, error: sErr } = await db.from('shifts')
    .select('user_id, shift_type, start_time, end_time, attendance').eq('date', day);
  if (sErr) throw sErr;
  const ids = [...new Set((shifts ?? []).map(s => String(s.user_id)))];
  const { data: profiles, error: pErr } = ids.length
    ? await db.from('profiles').select('id, name, role').in('id', ids)
    : { data: [], error: null };
  if (pErr) throw pErr;
  const byId = new Map((profiles ?? []).map(p => [String(p.id), p]));
  const rows: RosterRow[] = (shifts ?? []).map(s => {
    const p = byId.get(String(s.user_id));
    return {
      userId: String(s.user_id), name: (p?.name as string) ?? '', profileRole: (p?.role as string) ?? null,
      shiftType: s.shift_type as string, start: s.start_time as string | null, end: s.end_time as string | null,
      attendance: s.attendance as string | null,
    };
  });
  const { data: markRows, error: mErr } = await db.from('lot_crew').select('user_id, state, day, tapped_at').eq('day', day);
  if (mErr) throw mErr;
  const marks: CrewMark[] = (markRows ?? []).map(m => ({ userId: String(m.user_id), state: m.state as CrewState, day: m.day as string, at: m.tapped_at as string }));
  return { members: crewOf(rows, marks, day, nowMs), marks };
}

export async function loadCrew(db: SupabaseClient, nowMs: number, withNames: boolean): Promise<CrewPayload> {
  const { members, marks } = await loadMembers(db, nowMs);
  const changedAt = marks.reduce<string | null>((a, m) => (a == null || m.at > a ? m.at : a), null);
  return { summary: crewSummary(members), changedAt, ...(withNames ? { members } : {}) };
}

/** Set (or clear) the state for the given people. Only people on today's crew, in a state that fits their role. */
export async function markCrew(db: SupabaseClient, users: string[], state: CrewState | 'clear', by: string, nowIso: string): Promise<string | null> {
  const day = shiftBusinessDate(new Date(nowIso));
  const { members } = await loadMembers(db, Date.parse(nowIso));
  const known = new Map(members.map(m => [m.userId, m]));
  if (!users.every(u => known.has(u))) return 'Someone picked is not on today\'s crew.';
  if (state === 'clear') {
    const { error } = await db.from('lot_crew').delete().in('user_id', users);
    if (error) throw error;
    return null;
  }
  if (!users.every(u => stateFits(known.get(u)!.role, state))) return 'That is not a state for everyone picked.';
  const { error } = await db.from('lot_crew').upsert(users.map(u => ({ user_id: u, state, day, tapped_by: by, tapped_at: nowIso })));
  if (error) throw error;
  return null;
}
