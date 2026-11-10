// Lot Lookout's bay log (migration 161), pure: the rows read back from lot_bay_log, shaped into what the module and the
// read-only /lot/view show. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// His rulings, 2026-10-29, that shape everything here:
//   • *"cleans just go on a list. nothing gets removed"*.
//   • Cars and times, never names: the 2026-10-15 /lot/view rule. started_by is never read.
//   • Durations, NEVER: *"if it shows lol it might bite me later"*. A finished car shows its EXIT time and nothing else,
//     so no screen can be used to work out minutes per car, not even from two stamps side by side.
//   • A skip is a bump, not a verdict: *"skip to do later"*. It reads "still to do" until the car comes back in.
import { clockOf } from './lotBay';
import { classifyOdometerEntry, parseOdometer } from './odometer';
import { foldOZero } from './plateFold';
import { businessDateOf } from './shiftDay';
import { agoLabel, minutesAgo } from './lotLookout';

// 'erin' (2026-11-04, migration 164): *"cleaning them goes to their row to be rented at Erin St and not going up for the
// airport"*. A clean, off the dirties, never +1 on the cleans. Ticket: docs/ticket-bay-erin-exit-notes-existing-hold.md.
export type BayExit = 'clean' | 'mhold' | 'bhold' | 'skip' | 'erin';
/** What the bay card can tap: an exit, or ✈ Clean · sent up, which goes out as a Clean with `sent` (migration 169). */
export type BayLeave = BayExit | 'sent';

export interface BayLogRow {
  id: number;
  vehicle_id: string;
  plate: string;
  unit_number: string | null;
  car: string | null;
  odometer: number | null;
  started_at: string;
  exit: BayExit | null;
  exited_at: string | null;
  took_dirty: boolean;
  redo_of: number | null;
  shift_day: string;
  /** His note on the row (migration 164), shown on the read-only link too. */
  note: string | null;
  /** An M / B row tied to the hold already on the car ("Same as the … hold"). Set = flagged. */
  hold_id: string | null;
  /** Added after the fact, not started in the bay (migration 165): its time is when he added it. Optional so a row read
   *  before the column existed still types. */
  added?: boolean;
  /** ✈ Sent up (migration 167): a Clean that went straight back up. No time of its own. */
  sent_up?: boolean;
  /** A changed line's FIRST exit (migration 167), so it reads "was Clean"; null when unchanged. */
  was_exit?: BayExit | null;
  /** ✈ Clean · sent up (migration 169): this Clean left the bay straight up, a dirty off and no clean counted. */
  sent_at_exit?: boolean;
}

/** A note's cap: migration 164's check, and the server's NOTE_MAX. */
export const NOTE_MAX_CHARS = 140;

export const BAY_LOG_COLUMNS = 'id, vehicle_id, plate, unit_number, car, odometer, started_at, exit, exited_at, took_dirty, redo_of, shift_day, note, hold_id, added, sent_up, was_exit, sent_at_exit';

/** What one line of the list says. `kind` 'bay' is the car in the bay now. */
export type BayLineKind = BayExit | 'bay';
/** `note` is the list's own word (mechanical, still to do); `memo` is what HE wrote, '' for none. */
/** `sentUp`: ✈ marked (a Clean only). `sentAtExit`: it LEFT as ✈ Clean · sent up, so its mark is fixed (migration 169).
 *  `was`: the first exit's label once the exit was changed, '' when it wasn't. */
export interface BayLine { id: number; time: string; plate: string; car: string; kind: BayLineKind; label: string; note: string; memo: string; sentUp: boolean; sentAtExit: boolean; was: string }

const LABEL: Record<BayLineKind, string> = { clean: 'Clean', mhold: 'M hold', bhold: 'B hold', skip: 'Bumped', erin: 'Erin', bay: 'In the bay' };
/** On the read-only link a hold is "Held"; which kind is the note, and the hold itself stays in FG. */
const READ_ONLY_LABEL: Record<BayLineKind, string> = { ...LABEL, mhold: 'Held', bhold: 'Held' };

/** The one car in the bay, or null. The database allows only one (migration 161's index). */
export function inTheBay(rows: readonly BayLogRow[]): BayLogRow | null {
  return rows.find(r => r.exit == null) ?? null;
}

/** The day's list, in the order the cars went in. */
export function bayLines(rows: readonly BayLogRow[], { readOnly = false }: { readOnly?: boolean } = {}): BayLine[] {
  const labels = readOnly ? READ_ONLY_LABEL : LABEL;
  const redoBy = new Map<number, BayLogRow>();
  for (const r of rows) if (r.redo_of != null) redoBy.set(r.redo_of, r);
  return [...rows].sort((a, b) => a.started_at.localeCompare(b.started_at)).map(r => {
    const kind: BayLineKind = r.exit ?? 'bay';
    let note = '';
    if (kind === 'bay') note = `since ${clockOf(r.started_at)}`;
    else if (kind === 'mhold') note = 'mechanical';
    else if (kind === 'bhold') note = 'damage';
    else if (kind === 'erin') note = r.redo_of != null ? 'for Erin St · was bumped' : 'for Erin St';
    else if (kind === 'skip') {
      note = skipNote(redoBy.get(r.id));
    } else if (r.redo_of != null) note = 'was bumped';
    // Its stamp is when he added it, never when it was washed (2026-11-05, docs/ticket-bay-add-a-car-cleaned.md).
    if (r.added) note = note ? `added later · ${note}` : 'added later';
    // The exit time, never the start, once the car is out: one stamp per finished car (no durations).
    const time = clockOf(r.exited_at ?? r.started_at);
    // Migration 167: the mark, and what a changed line was first, so the list never quietly rewrites what was seen.
    const sentUp = kind === 'clean' && r.sent_up === true;
    const was = r.was_exit && r.was_exit !== kind ? labels[r.was_exit] : '';
    const sentAtExit = kind === 'clean' && r.sent_at_exit === true;
    return { id: r.id, time, plate: r.plate, car: r.car ?? '', kind, label: labels[kind], note, memo: r.note ?? '', sentUp, sentAtExit, was };
  });
}

/** What became of a bumped car: its restart's exit, or "still to do" while it has none. */
function skipNote(redo: BayLogRow | undefined): string {
  if (!redo) return 'still to do';
  if (!redo.exit || !redo.exited_at) return 'back in the bay';
  if (redo.exit === 'clean' || redo.exit === 'erin') return `redone ${clockOf(redo.exited_at)}`;
  // Bumped again, or held on the second pass: the restart's own line says which.
  return redo.exit === 'skip' ? 'bumped again' : 'held on redo';
}

export interface BaySummary { clean: number; erin: number; mhold: number; bhold: number; stillToDo: number }

/** The day's chips. A bumped car counts as still to do until its restart has an exit. */
export function baySummary(rows: readonly BayLogRow[]): BaySummary {
  const redone = new Set(rows.map(r => r.redo_of).filter((x): x is number => x != null));
  const count = (e: BayExit) => rows.filter(r => r.exit === e).length;
  return {
    clean: count('clean'), erin: count('erin'), mhold: count('mhold'), bhold: count('bhold'),
    // The last skip in a chain is the one still waiting; an earlier one was picked up again.
    stillToDo: rows.filter(r => r.exit === 'skip' && !redone.has(r.id)).length,
  };
}

/** The Start button's gate: may this car go in? Null = yes, else the reason the button shows instead. */
export function startBlock(open: BayLogRow | null, vehicleId: string): { plate: string; since: string; same: boolean } | null {
  if (!open) return null;
  return { plate: open.plate, since: clockOf(open.started_at), same: open.vehicle_id === vehicleId };
}

// ── Already on today's list (Aaron, 2026-11-06: *"Maybe a heads up "this vehicle was already cleaned (insert time since)
// ago"?"*; docs/ticket-bay-already-done-today.md). LUR322 went through twice in five minutes, LUR367 got a Clean after
// its B. A warning, never a block: a car really can come back dirty the same day.

export type DoneToday = Pick<BayLogRow, 'plate' | 'exit' | 'exited_at'> & { exit: Exclude<BayExit, 'skip'>; exited_at: string };

/** The car's latest FINISHED row on the day's list, or null. A Skip says nothing: a skipped car is meant to come back. */
export function doneToday(rows: readonly BayLogRow[], vehicleId: string): DoneToday | null {
  const last = rows.filter(r => r.vehicle_id === vehicleId && r.exit && r.exited_at)
    .reduce<BayLogRow | null>((a, r) => (!a || Date.parse(r.exited_at!) > Date.parse(a.exited_at!) ? r : a), null);
  return last && last.exit !== 'skip' ? (last as DoneToday) : null;
}

const DONE_VERB: Record<DoneToday['exit'], string> = {
  clean: 'was cleaned', erin: 'was cleaned for Erin St', mhold: 'went on M hold', bhold: 'went on B hold',
};

/** "LUR322 was cleaned 4 min ago (14:40)". */
export function doneTodayLine(d: DoneToday, nowMs: number): string {
  return `${d.plate} ${DONE_VERB[d.exit]} ${agoLabel(minutesAgo(d.exited_at, nowMs))} (${clockOf(d.exited_at)})`;
}

/**
 * The bay card's own Find a car (Aaron, 2026-10-29: *"i'm already in the module ... that button should be the input
 * search box"*; docs/ticket-bay-find-a-car-inline-search.md): the FG record behind what he picked or typed. A picked
 * suggestion is matched on plate AND unit (a mock can share a real car's plate). A typed key must be a WHOLE plate
 * (O read as 0) or a whole unit; a fragment is a search, not a car, so it is null and the list does the finding.
 */
export function vehicleForPick<V extends { licensePlate: string; unitNumber: string | null }>(
  vehicles: readonly V[],
  choice: { plate: string; unit: string | null } | { typed: string },
): V | null {
  if ('plate' in choice) {
    return vehicles.find(v => v.licensePlate === choice.plate && (v.unitNumber ?? null) === (choice.unit ?? null)) ?? null;
  }
  const key = foldOZero(choice.typed.trim());
  if (!key) return null;
  return vehicles.find(v => foldOZero(v.licensePlate) === key || (v.unitNumber ?? '') === key) ?? null;
}


/** The shift report's bay line (Aaron, 2026-11-01: *"you can include it, they aren't being sent anywhere. but its good to
 *  have"*). Counts only, zeros hidden, a bumped car counted only while it's still to do; null on a day with no cars. */
export function bayReportLine(rows: readonly BayLogRow[]): string | null {
  if (!rows.length) return null;
  const s = baySummary(rows);
  const parts = [`${s.clean} clean`];
  if (s.erin) parts.push(`${s.erin} for Erin St`);
  if (s.bhold) parts.push(`${s.bhold} B hold`);
  if (s.mhold) parts.push(`${s.mhold} M hold`);
  if (s.stillToDo) parts.push(`${s.stillToDo} bumped, still to do`);
  return parts.join(' · ');
}

/** What the bay card's odo box holds right now. 'log' and 'same' carry a reading; 'lower' and 'unreadable' hold every exit
 *  until he corrects it or clears the box, because a number he typed is never silently dropped (Aaron, 2026-11-02,
 *  docs/ticket-bay-odo-in-card-and-next-up.md). */
export type BayOdoEntry = { kind: 'empty' } | { kind: 'unreadable' } | { kind: 'log' | 'same' | 'lower'; km: number };

export function bayOdoEntry(draft: string, currentKm: number | null | undefined): BayOdoEntry {
  if (!draft.trim()) return { kind: 'empty' };
  const km = parseOdometer(draft);
  const entry = classifyOdometerEntry(currentKm, km);
  if (km === null || entry === 'invalid') return { kind: 'unreadable' };
  return entry === 'same' ? { kind: 'same', km } : entry === 'lower' ? { kind: 'lower', km } : { kind: 'log', km };
}

/** May the car leave with this in the box? */
export function bayOdoLetsExit(e: BayOdoEntry): boolean {
  return e.kind === 'empty' || e.kind === 'log' || e.kind === 'same';
}

// ── M / B as one tap (Aaron, 2026-11-03: *"Choosing M or B from the exit options after cleaning just marks them as M or B
// on the list. Going through the form to fill everything out is costing me time."*; ticket-bay-on-deck-trip-clean-quick-holds).
// The mark is on the list; the HOLD is still FG's only word that the car is held. So until one is flagged, the row
// offers Flag it and Find a car says "not flagged yet", never ✅ Clear.

/** Just what a hold needs to have for the check: whose car, and when it was flagged. */
export interface HoldStamp { vehicleId: string; flaggedAt: string }
export type HoldExit = Extract<BayExit, 'mhold' | 'bhold'>;
export interface BayMark { kind: HoldExit; at: string }

const isHoldExit = (e: BayExit | null): e is HoldExit => e === 'mhold' || e === 'bhold';

/** A hold exit with no hold flagged on that car since it went in or on the same business day, and not tied to the one
 *  already on it (hold_id, 2026-11-04). Compared as instants: a hold's ISO and Postgres' timestamptz text are spelled
 *  differently ("Z" vs "+00:00").
 *
 *  ⭐ The same day counts (Aaron, 2026-11-06, docs/ticket-bay-mark-flagged-same-day.md): *"I've flagged it through the
 *  regular process"*. LJF683's hold went in at 14:28 and the car into the bay at 14:30, and "since it went in" kept
 *  nagging him about a hold he'd already flagged. An EARLIER day's hold still doesn't count: "Same as the … hold" is
 *  how he ties a new mark to an old one. */
export function isUnflaggedHold(row: Pick<BayLogRow, 'vehicle_id' | 'exit' | 'started_at' | 'shift_day'> & { hold_id?: string | null }, holds: readonly HoldStamp[]): boolean {
  if (!isHoldExit(row.exit) || row.hold_id) return false;
  const since = Date.parse(row.started_at);
  return !holds.some(h => h.vehicleId === row.vehicle_id
    && (Date.parse(h.flaggedAt) >= since || businessDateOf(h.flaggedAt) === row.shift_day));
}

/** The rows on a day's list that still carry Flag it. */
export function unflaggedHoldIds(rows: readonly BayLogRow[], holds: readonly HoldStamp[]): Set<number> {
  return new Set(rows.filter(r => isUnflaggedHold(r, holds)).map(r => r.id));
}

/** What Find a car says about a car, from its LATEST finished bay row: a hold mark not yet flagged, or null. A later
 *  Clean or Skip of the same car is the newer row, so it clears the mark by itself.
 *
 *  ⭐ Only on the mark's own business day (2026-11-06): MCN113's 11-05 M read "M hold in the bay 13:09 · not flagged
 *  yet" on the 6th, with no date, so yesterday's mark passed for today's. Flag it lives on the day's list; the reminder
 *  ends with the day. */
export function bayMarkOf(last: (Pick<BayLogRow, 'vehicle_id' | 'exit' | 'started_at' | 'exited_at' | 'shift_day'> & { hold_id?: string | null }) | null, holds: readonly HoldStamp[], today: string): BayMark | null {
  if (!last || !last.exited_at || last.shift_day !== today || !isHoldExit(last.exit) || !isUnflaggedHold(last, holds)) return null;
  return { kind: last.exit, at: last.exited_at };
}

/** The status line it takes the place of: "⚠️ B hold in the bay 10:42 · not flagged yet". */
export function bayMarkLine(m: BayMark): string {
  return `${m.kind === 'bhold' ? '⚠️ B hold' : '🔧 M hold'} in the bay ${clockOf(m.at)} · not flagged yet`;
}

// ── Flag it offers the hold already on the car (Aaron, 2026-11-04: *"For M and B, if it has an existing flag on it maybe
// having it available to select?"* → *"Keeping the same flow, going back to it later on the cleaned list"*). The exit
// stays one tap; on the list, an M / B row whose car already has a fitting ACTIVE hold offers "Same as the … hold".

/** What the list needs of a hold to offer it. */
export interface OpenHold { id: string; vehicleId: string; status: string; holdTypes: readonly string[]; flaggedAt: string }

/** M is mechanical; B is damage, and hail is damage too. The same rule as the server's holdFitsExit. */
export function holdFits(exit: BayExit | null, holdTypes: readonly string[]): boolean {
  if (exit === 'mhold') return holdTypes.includes('mechanical');
  if (exit === 'bhold') return holdTypes.includes('damage') || holdTypes.includes('hail');
  return false;
}

/** The ACTIVE holds an unflagged M / B row could be the same as, newest first. Empty = Flag it goes straight to the form. */
export function sameHoldChoices<H extends OpenHold>(row: Pick<BayLogRow, 'vehicle_id' | 'exit'>, holds: readonly H[]): H[] {
  return holds
    .filter(h => h.vehicleId === row.vehicle_id && h.status === 'ACTIVE' && holdFits(row.exit, h.holdTypes))
    .sort((a, b) => Date.parse(b.flaggedAt) - Date.parse(a.flaggedAt));
}

const HOLD_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Winnipeg', month: 'short', day: 'numeric' });

/** "Same as the Oct 28 hold": the day a hold was flagged, Winnipeg time. */
export function sameHoldLabel(flaggedAt: string): string {
  return `Same as the ${HOLD_DAY.format(new Date(flaggedAt))} hold`;
}
