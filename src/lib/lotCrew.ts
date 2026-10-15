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
}

export interface CrewSummary {
  vsa: { cleaning: number; moving: number; out: number };
  driver: { airport: number; other: number; out: number };
}

export interface CrewPayload {
  summary: CrewSummary;
  changedAt: string | null;
  members?: CrewMember[];
}

/** "Cleaning 1 of 2 · 1 moving cars · 1 out". The "of" counts who is working, so an out never reads as idle. */
export function vsaLine(s: CrewSummary['vsa']): string {
  const working = s.cleaning + s.moving;
  if (working + s.out === 0) return 'No VSAs on right now';
  const parts = [`Cleaning ${s.cleaning} of ${working}`];
  if (s.moving) parts.push(`${s.moving} moving cars`);
  if (s.out) parts.push(`${s.out} out`);
  return parts.join(' · ');
}

/** "To the airport 1 of 3 · 2 on another job". */
export function driverLine(s: CrewSummary['driver']): string {
  const working = s.airport + s.other;
  if (working + s.out === 0) return 'No drivers on right now';
  const parts = [`To the airport ${s.airport} of ${working}`];
  if (s.other) parts.push(`${s.other} on another job`);
  if (s.out) parts.push(`${s.out} out`);
  return parts.join(' · ');
}
