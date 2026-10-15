// Lot Lookout: today's crew, pure. Who is on right now, and what each one is doing. (Ticket:
// docs/ticket-lot-lookout-day-crew.md; migration 154.)
//
// ⭐ Aaron, 2026-10-15: *"Example myself and Moaz are on and I just send Moaz. The display would show just one active
// cleaner and the other running ... At one point I had 3, and two were pulled to move cars to auction. So I only had
// 1 moving cars to the airport"*.
//
// The roster is FG's `shifts` for the shift-day; a mark (lot_crew) is only what he changed. Rules:
//   • VSAs (and the Lead VSA) default to CLEANING; drivers to TO THE AIRPORT.
//   • "Out" is one plain state. A shift typed `sick`, or attendance `absent`, reads as out; never with a reason.
//   • Someone counts while their shift window covers now. A mark made AFTER their window ended means they stayed
//     (overtime, like his today), so they count until the shift-day turns over.
//   • Day-off and PTO are not today's crew at all.

const TZ = 'America/Winnipeg';

export type CrewRole = 'vsa' | 'driver';
export type CrewState = 'cleaning' | 'moving' | 'airport' | 'other' | 'out';
export const CREW_STATES: Record<CrewRole, readonly CrewState[]> = {
  vsa: ['cleaning', 'moving', 'out'],
  driver: ['airport', 'other', 'out'],
};
const DEFAULT_STATE: Record<CrewRole, CrewState> = { vsa: 'cleaning', driver: 'airport' };
const WORKING = new Set(['opening', 'mid', 'closing']);

export function crewRoleOf(profileRole: string | null | undefined): CrewRole | null {
  if (profileRole === 'VSA' || profileRole === 'LeadVSA' || profileRole === 'Lead VSA') return 'vsa';
  if (profileRole === 'Driver') return 'driver';
  return null;
}

export function stateFits(role: CrewRole, state: CrewState): boolean {
  return CREW_STATES[role].includes(state);
}

function offsetMs(atMs: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(atMs)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(atMs / 1000) * 1000;
}

/** A Winnipeg wall-clock time on a date ("2026-10-15", "14:30:00") as an instant. DST-safe. */
export function winnipegInstant(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(guess);
  const again = guess - offsetMs(t);
  if (again !== t) t = again;
  return t;
}

export interface RosterRow {
  userId: string;
  name: string;
  profileRole: string | null;
  shiftType: string;
  start: string | null;
  end: string | null;
  attendance: string | null;
}

export interface CrewMark { userId: string; state: CrewState; day: string; at: string }

export interface CrewMember {
  userId: string;
  name: string;
  role: CrewRole;
  /** "06:45"–"15:15", or null when the shift has no times. */
  start: string | null;
  end: string | null;
  state: CrewState;
  /** Counted right now. */
  onNow: boolean;
  /** Not counted: not in yet, or their shift is over. */
  phase: 'later' | 'on' | 'done';
  marked: boolean;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export function crewOf(rows: readonly RosterRow[], marks: readonly CrewMark[], day: string, nowMs: number): CrewMember[] {
  const out: CrewMember[] = [];
  for (const r of rows) {
    const role = crewRoleOf(r.profileRole);
    if (!role) continue;
    const absent = r.shiftType === 'sick' || r.attendance === 'absent';
    if (!WORKING.has(r.shiftType) && !absent) continue;
    const mark = marks.find(m => m.userId === r.userId && m.day === day && stateFits(role, m.state));
    const state: CrewState = mark?.state ?? (absent ? 'out' : DEFAULT_STATE[role]);
    let phase: CrewMember['phase'] = 'on';
    let within = false;
    let stayed = false;
    if (r.start && r.end) {
      const startMs = winnipegInstant(day, r.start);
      let endMs = winnipegInstant(day, r.end);
      if (endMs <= startMs) endMs += 24 * 3600_000;
      within = nowMs >= startMs && nowMs < endMs;
      phase = nowMs < startMs ? 'later' : nowMs >= endMs ? 'done' : 'on';
      stayed = mark != null && Date.parse(mark.at) >= endMs;
    } else {
      // A sick row has no times: it is out for the whole day.
      within = absent;
      phase = absent ? 'on' : 'later';
    }
    const onNow = state === 'out' ? within : within || stayed;
    if (onNow && phase === 'done') phase = 'on';
    out.push({ userId: r.userId, name: r.name, role, start: hhmm(r.start), end: hhmm(r.end), state, onNow, phase, marked: mark != null });
  }
  return out.sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99') || a.name.localeCompare(b.name));
}

export interface CrewSummary {
  vsa: { cleaning: number; moving: number; out: number };
  driver: { airport: number; other: number; out: number };
}

/** Numbers only: what the read-only view gets. */
export function crewSummary(members: readonly CrewMember[]): CrewSummary {
  const s: CrewSummary = { vsa: { cleaning: 0, moving: 0, out: 0 }, driver: { airport: 0, other: 0, out: 0 } };
  for (const m of members) {
    if (!m.onNow) continue;
    if (m.role === 'vsa') s.vsa[m.state as 'cleaning' | 'moving' | 'out'] += 1;
    else s.driver[m.state as 'airport' | 'other' | 'out'] += 1;
  }
  return s;
}
