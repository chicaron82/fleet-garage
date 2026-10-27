// Lot Lookout crew, page side: the shapes GET /api/lot returns, and the words the counts are said in. The rules that
// decide who is on live server side (api/_lib/lotCrew.ts — the read-only view must never receive names). Tickets:
// docs/ticket-lot-lookout-day-crew.md, docs/ticket-crew-line-is-the-schedule.md.
//
// ⭐ THE CREW LINE IS THE SCHEDULE (Aaron, 2026-10-24): *"So who's on just shows who's scheduled (regardless if I've
// marked present or not)"*. No job states, no present gate. Sick and no-shows are "out", never with a reason.

export type CrewRole = 'vsa' | 'driver';

export interface CrewMember {
  userId: string;
  name: string;
  role: CrewRole;
  start: string | null;
  end: string | null;
  /** The [+] blocks under Actual Hours (migration 160): more hours the same day. Empty = none. */
  more: { start: string; end: string }[];
  /** Sick on the schedule, or marked a no-show. */
  out: boolean;
  onNow: boolean;
  phase: 'later' | 'on' | 'done';
}

export interface CrewSummary {
  vsa: { on: number; out: number };
  driver: { on: number; out: number };
}

export interface CrewPayload {
  summary: CrewSummary;
  members?: CrewMember[];
  /** Who is left off the crew line (migration 155): signed-in only. */
  leftOff?: { userId: string; name: string }[];
}

/** "2 on · 1 out", or "None on right now". */
export function crewLine(s: { on: number; out: number }): string {
  if (s.on + s.out === 0) return 'None on right now';
  const parts = [`${s.on} on`];
  if (s.out) parts.push(`${s.out} out`);
  return parts.join(' · ');
}

/** The list his panel shows up top: on now, out today, or not in yet. Finished shifts fold away (Aaron, 2026-10-15:
 *  *"i'm thinking of removing those who's shift window has passed"*). */
export function splitFinished<T extends { onNow: boolean; phase: 'later' | 'on' | 'done' }>(list: readonly T[]): { current: T[]; finished: T[] } {
  const finished = list.filter(m => m.phase === 'done' && !m.onNow);
  return { current: list.filter(m => !finished.includes(m)), finished };
}
