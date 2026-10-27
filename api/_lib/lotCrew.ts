// Lot Lookout: today's crew, pure. Who is on right now. (Tickets: docs/ticket-lot-lookout-day-crew.md, migration 154;
// docs/ticket-crew-line-is-the-schedule.md.)
//
// ⭐ THE CREW LINE IS THE SCHEDULE (Aaron, 2026-10-24): *"The who's running feature is too scope-y. Keeping track is too
// much. Let's just simply it. So who's on just shows who's scheduled (regardless if I've marked present or not)"*.
// It used to carry a job state per person (cleaning / moving cars, airport / another job) and wait for a present tap
// before counting anyone. Both were bookkeeping he had to keep current by hand. Now:
//   • ON = a working shift whose window covers now. Present or not doesn't matter.
//   • OUT = a shift typed `sick`, or attendance `absent` (a no-show). Never with a reason. (His "Yes" to sick and
//     no-show dropping off the count, 2026-10-24.)
//   • LOGGED HOURS WIN (2026-10-15, his overtime): actual start/end, where logged, replace the scheduled ones, so
//     staying late is just logging it.
//   • MORE HOURS COUNT (migration 160, 2026-10-26): a [+] block is logged hours too. He opened, went home, and came
//     back 17:00–21:00 so Erick wasn't cleaning solo; the line read him as finished. Inside a block = on; between
//     the shift and a block = later (coming back, so not folded away as finished); after the last one = done.
//   • Day-off and PTO are not today's crew at all.
//   • LEFT OFF (migration 155): someone on a crew schedule who isn't part of this line (Larry C, the in-house
//     utility man on the driver schedule) is not a member at all, so never counted. No reason is kept.

const TZ = 'America/Winnipeg';

export type CrewRole = 'vsa' | 'driver';
const WORKING = new Set(['opening', 'mid', 'closing']);

export function crewRoleOf(profileRole: string | null | undefined): CrewRole | null {
  if (profileRole === 'VSA' || profileRole === 'LeadVSA' || profileRole === 'Lead VSA') return 'vsa';
  if (profileRole === 'Driver') return 'driver';
  return null;
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
  /** Logged actual hours (shifts.actual_start_time / actual_end_time). Each one, where present, wins. */
  actualStart?: string | null;
  actualEnd?: string | null;
  /** The [+] blocks (shifts.extra_blocks): more hours the same day, each its own window. */
  extraBlocks?: ReadonlyArray<{ start: string; end: string }> | null;
  attendance: string | null;
}

export interface CrewMember {
  userId: string;
  name: string;
  role: CrewRole;
  /** "06:45"–"15:15", or null when the shift has no times. Logged actual hours where there are any. */
  start: string | null;
  end: string | null;
  /** The [+] blocks, "17:00"–"21:00". Empty = none. */
  more: { start: string; end: string }[];
  /** Sick on the schedule, or marked a no-show. */
  out: boolean;
  /** On right now: a working shift whose window covers now, and not out. */
  onNow: boolean;
  /** Where the shift stands: not in yet, on, or over. An out person reads 'on' all day (they are today's news). */
  phase: 'later' | 'on' | 'done';
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** One window as instants. The end crosses midnight when it isn't after the start (a 16:30–01:00 close); a window
 *  that starts before the 04:00 cutover belongs to the night after `day` (the business day runs to 04:00). */
function windowOf(day: string, start: string, end: string, afterMidnight: boolean): [number, number] {
  const bump = afterMidnight ? 24 * 3600_000 : 0;
  const startMs = winnipegInstant(day, start) + bump;
  let endMs = winnipegInstant(day, end) + bump;
  if (endMs <= startMs) endMs += 24 * 3600_000;
  return [startMs, endMs];
}

export function crewOf(
  rows: readonly RosterRow[], day: string, nowMs: number, leftOff: ReadonlySet<string> = new Set(),
): CrewMember[] {
  const members: CrewMember[] = [];
  for (const r of rows) {
    const role = crewRoleOf(r.profileRole);
    if (!role || leftOff.has(r.userId)) continue;
    const out = r.shiftType === 'sick' || r.attendance === 'absent';
    if (!WORKING.has(r.shiftType) && !out) continue;
    const start = r.actualStart || r.start;
    const end = r.actualEnd || r.end;
    const more = (r.extraBlocks ?? []).filter(b => b.start && b.end).map(b => ({ start: b.start.slice(0, 5), end: b.end.slice(0, 5) }));
    let phase: CrewMember['phase'] = out ? 'on' : 'later';
    if (!out && start && end) {
      const windows = [windowOf(day, start, end, false), ...more.map(b => windowOf(day, b.start, b.end, b.start < '04:00'))];
      phase = windows.some(([s, e]) => nowMs >= s && nowMs < e) ? 'on'
        : windows.every(([, e]) => nowMs >= e) ? 'done'
        : 'later';
    }
    members.push({ userId: r.userId, name: r.name, role, start: hhmm(start), end: hhmm(end), more, out, onNow: !out && phase === 'on', phase });
  }
  return members.sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99') || a.name.localeCompare(b.name));
}

export interface CrewSummary {
  vsa: { on: number; out: number };
  driver: { on: number; out: number };
}

/** Numbers only: what the read-only view gets. */
export function crewSummary(members: readonly CrewMember[]): CrewSummary {
  const s: CrewSummary = { vsa: { on: 0, out: 0 }, driver: { on: 0, out: 0 } };
  for (const m of members) {
    if (m.out) s[m.role].out += 1;
    else if (m.onNow) s[m.role].on += 1;
  }
  return s;
}
