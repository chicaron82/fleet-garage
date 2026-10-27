// Lot Lookout crew, the database side for api/lot.ts: read today's roster (shifts + profiles) and who is left off the
// line. The rules are pure in lotCrew.ts. Service role only: profiles' names are never SENT to a caller who isn't
// signed in to FG.
//
// ⚠️ lot_crew (migration 154, the per-person job marks) is no longer read or written: since 2026-10-24 the crew line
// is the schedule (docs/ticket-crew-line-is-the-schedule.md). The table stays, unused.
import type { SupabaseClient } from '@supabase/supabase-js';
import { crewOf, crewSummary, type CrewMember, type CrewSummary, type RosterRow } from './lotCrew.js';
import { shiftBusinessDate } from './shiftDay.js';

export interface CrewPayload {
  summary: CrewSummary;
  /** Names: only for a signed-in FG session. */
  members?: CrewMember[];
  /** Who is left off the crew line (migration 155), with names — signed-in FG only, like `members`. */
  leftOff?: { userId: string; name: string }[];
}

interface Loaded { members: CrewMember[]; leftOff: { userId: string; name: string }[] }

async function loadMembers(db: SupabaseClient, nowMs: number): Promise<Loaded> {
  const day = shiftBusinessDate(new Date(nowMs));
  const { data: shifts, error: sErr } = await db.from('shifts')
    .select('user_id, shift_type, start_time, end_time, actual_start_time, actual_end_time, extra_blocks, attendance').eq('date', day);
  if (sErr) throw sErr;
  const { data: offRows, error: oErr } = await db.from('lot_crew_left_off').select('user_id');
  if (oErr) throw oErr;
  const offIds = (offRows ?? []).map(o => String(o.user_id));
  const ids = [...new Set([...(shifts ?? []).map(s => String(s.user_id)), ...offIds])];
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
      actualStart: s.actual_start_time as string | null, actualEnd: s.actual_end_time as string | null,
      extraBlocks: Array.isArray(s.extra_blocks) ? s.extra_blocks as { start: string; end: string }[] : null,
      attendance: s.attendance as string | null,
    };
  });
  const leftOff = offIds.map(id => ({ userId: id, name: (byId.get(id)?.name as string) ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { members: crewOf(rows, day, nowMs, new Set(offIds)), leftOff };
}

export async function loadCrew(db: SupabaseClient, nowMs: number, withNames: boolean): Promise<CrewPayload> {
  const { members, leftOff } = await loadMembers(db, nowMs);
  return { summary: crewSummary(members), ...(withNames ? { members, leftOff } : {}) };
}

/** Leave someone off the crew line, or bring them back (migration 155). */
export async function leaveOff(db: SupabaseClient, user: string, off: boolean, by: string, nowIso: string): Promise<void> {
  if (off) {
    const { error } = await db.from('lot_crew_left_off').upsert({ user_id: user, left_by: by, left_at: nowIso });
    if (error) throw error;
    return;
  }
  const { error } = await db.from('lot_crew_left_off').delete().eq('user_id', user);
  if (error) throw error;
}
