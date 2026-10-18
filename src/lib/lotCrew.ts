// Lot Lookout crew, page side: the shapes GET /api/lot returns, and the words the counts are said in. The rules that
// decide who is on and what they are doing live server side (api/_lib/lotCrew.ts — the browser can't read lot_crew,
// and the read-only view must never receive names). Ticket: docs/ticket-lot-lookout-day-crew.md.
//
// His calls, 2026-10-15: the read-only view shows NUMBERS, never names; "out" is one plain state, never a reason.

export type CrewRole = 'vsa' | 'driver';
export type CrewState = 'cleaning' | 'moving' | 'airport' | 'other' | 'out';

export const CREW_STATES: Record<CrewRole, readonly CrewState[]> = {
  vsa: ['cleaning', 'moving', 'out'],
  driver: ['airport', 'other', 'out'],
};

export const CREW_STATE_LABEL: Record<CrewState, string> = {
  cleaning: 'Cleaning', moving: 'Moving cars', airport: 'To the airport', other: 'Other job', out: 'Out',
};

export interface CrewMember {
  userId: string;
  name: string;
  role: CrewRole;
  start: string | null;
  end: string | null;
  state: CrewState;
  onNow: boolean;
  phase: 'later' | 'on' | 'done';
  marked: boolean;
  /** Present, a no-show, or marked by hand (2026-10-18). Unconfirmed = "not marked yet". Absent on an older server. */
  confirmed?: boolean;
}

export interface CrewSummary {
  vsa: { cleaning: number; moving: number; out: number; unmarked?: number };
  driver: { airport: number; other: number; out: number; unmarked?: number };
}

export interface CrewPayload {
  summary: CrewSummary;
  changedAt: string | null;
  members?: CrewMember[];
  /** Who is left off the crew line (migration 155): signed-in only. */
  leftOff?: { userId: string; name: string }[];
}

/** "Cleaning 1 of 2 · 1 moving cars · 1 out". The "of" counts who is working, so an out never reads as idle.
 *  ⭐ "· 2 not marked yet" (2026-10-18): someone on now but not yet marked present is counted in the "of" and said
 *  plainly, so an early-shift line reads as unconfirmed, never as nobody working. */
export function vsaLine(s: CrewSummary['vsa']): string {
  const unmarked = s.unmarked ?? 0;
  const working = s.cleaning + s.moving + unmarked;
  if (working + s.out === 0) return 'No VSAs on right now';
  const parts = [`Cleaning ${s.cleaning} of ${working}`];
  if (s.moving) parts.push(`${s.moving} moving cars`);
  if (unmarked) parts.push(`${unmarked} not marked yet`);
  if (s.out) parts.push(`${s.out} out`);
  return parts.join(' · ');
}

/** "To the airport 1 of 3 · 2 on another job". */
export function driverLine(s: CrewSummary['driver']): string {
  const unmarked = s.unmarked ?? 0;
  const working = s.airport + s.other + unmarked;
  if (working + s.out === 0) return 'No drivers on right now';
  const parts = [`To the airport ${s.airport} of ${working}`];
  if (s.other) parts.push(`${s.other} on another job`);
  if (unmarked) parts.push(`${unmarked} not marked yet`);
  if (s.out) parts.push(`${s.out} out`);
  return parts.join(' · ');
}

/** The list his panel shows up top: on now, or not in yet. Finished shifts fold away (Aaron, 2026-10-15: *"i'm
 *  thinking of removing those who's shift window has passed"*) — but never anyone still counted, so a stayed-late
 *  mark or logged overtime keeps them in view. */
export function splitFinished<T extends { onNow: boolean; phase: 'later' | 'on' | 'done' }>(list: readonly T[]): { current: T[]; finished: T[] } {
  const finished = list.filter(m => m.phase === 'done' && !m.onNow);
  return { current: list.filter(m => !finished.includes(m)), finished };
}
