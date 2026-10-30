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

export type BayExit = 'clean' | 'mhold' | 'bhold' | 'skip';

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
}

export const BAY_LOG_COLUMNS = 'id, vehicle_id, plate, unit_number, car, odometer, started_at, exit, exited_at, took_dirty, redo_of, shift_day';

/** What one line of the list says. `kind` 'bay' is the car in the bay now. */
export type BayLineKind = BayExit | 'bay';
export interface BayLine { id: number; time: string; plate: string; car: string; kind: BayLineKind; label: string; note: string }

const LABEL: Record<BayLineKind, string> = { clean: 'Clean', mhold: 'M hold', bhold: 'B hold', skip: 'Bumped', bay: 'In the bay' };
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
    else if (kind === 'skip') {
      note = skipNote(redoBy.get(r.id));
    } else if (r.redo_of != null) note = 'was bumped';
    // The exit time, never the start, once the car is out: one stamp per finished car (no durations).
    const time = clockOf(r.exited_at ?? r.started_at);
    return { id: r.id, time, plate: r.plate, car: r.car ?? '', kind, label: labels[kind], note };
  });
}

/** What became of a bumped car: its restart's exit, or "still to do" while it has none. */
function skipNote(redo: BayLogRow | undefined): string {
  if (!redo) return 'still to do';
  if (!redo.exit || !redo.exited_at) return 'back in the bay';
  if (redo.exit === 'clean') return `redone ${clockOf(redo.exited_at)}`;
  // Bumped again, or held on the second pass: the restart's own line says which.
  return redo.exit === 'skip' ? 'bumped again' : 'held on redo';
}

export interface BaySummary { clean: number; mhold: number; bhold: number; stillToDo: number }

/** The day's chips. A bumped car counts as still to do until its restart has an exit. */
export function baySummary(rows: readonly BayLogRow[]): BaySummary {
  const redone = new Set(rows.map(r => r.redo_of).filter((x): x is number => x != null));
  const count = (e: BayExit) => rows.filter(r => r.exit === e).length;
  return {
    clean: count('clean'), mhold: count('mhold'), bhold: count('bhold'),
    // The last skip in a chain is the one still waiting; an earlier one was picked up again.
    stillToDo: rows.filter(r => r.exit === 'skip' && !redone.has(r.id)).length,
  };
}

/** The Start button's gate: may this car go in? Null = yes, else the reason the button shows instead. */
export function startBlock(open: BayLogRow | null, vehicleId: string): { plate: string; since: string; same: boolean } | null {
  if (!open) return null;
  return { plate: open.plate, since: clockOf(open.started_at), same: open.vehicle_id === vehicleId };
}
