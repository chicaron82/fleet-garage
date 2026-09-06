import type { Vehicle } from '../types';
import { isDisposition } from './disposition';
import { ROW_CAPACITY, rowLabel, suggestRow } from './closingInventoryLot';

// The closing write-up — Hertz form 8073-16, "Location Daily Vehicle Inventory".
//
// ⭐⭐ WHY THE SCANNER MAKES THIS A DIFFERENT JOB. The sheet asks for six things per car, and the
// KEY TAG already prints four of them: owning area, unit number, licence and the rental class off
// its top line. Aaron's two sheets from Sept 1 hold **57 cars** between them, hand-written. So the
// work is four columns of transcription plus one decision, and the tag has already said the four.
//
// ⚠️ IT SUPPLEMENTS THE PAPER, IT DOES NOT REPLACE IT. His words: *"if I happen to close I'll use
// it. it's not a replacement. just another method of doing things."* Other people close, and they
// close on paper. Nothing here may assume anyone else adopts anything.
//
// ⚠️ `Mileage`, `AM Check` and `Arrived Overnight` are blank on both his PM sheets — they belong to
// the morning pass. Deliberately absent; rendering dead columns would be theatre.
//
// This module is the whole rule-set, pure. The surface is a separate pass.

/** The form's own legend, complete. There is no sixth code. */
export type InventoryStatus = 'A' | 'D' | 'B' | 'M' | 'F';

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  A: 'Available',
  D: 'Dirty',
  B: 'Body',
  M: 'Mechanical',
  F: 'Foreign',
};

/** One line of the sheet. */
export interface InventoryEntry {
  vehicleId: string | null;   // null for a car typed in by hand
  plate: string;
  unitNumber: string | null;
  owningArea: string | null;
  rentalClass: string | null;
  status: InventoryStatus;
  /** Only meaningful for `A` — where the car is. Stored bare ("5", "SF"); rendered as "R-5". */
  row: string;
  /** Free text. B → what kind of damage; M → what kind of mechanical; anything else optional. */
  note: string;
}

// ⭐ The LOT's own knowledge — the class→row bands, row capacity, and how a row is written — lives
// in `closingInventoryLot`, re-exported here so the model still presents ONE interface to the
// surface. The split is about the 330-line cap, not a new seam for callers to learn.
export { ROW_CAPACITY, suggestBand, suggestRow, rowLabel } from './closingInventoryLot';

/**
 * The unit number as the KEY TAG prints it — `5426408` → `542 6408`.
 *
 * ⭐ The space is not decoration: the tag groups the digits that way, so a written sheet that keeps
 * the grouping can be checked against the tag at a glance. Aaron's own sheets are written like this.
 *
 * ⚠️ Anything that is not seven digits passes through UNCHANGED rather than being regrouped into a
 * shape no tag ever printed. A unit FG has never seen is null, and a hand-entered row has none at
 * all — both are legitimate, so this never invents one.
 */
export function formatUnitNumber(unit: string | null | undefined): string {
  const raw = (unit ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length === 7 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : raw;
}

/**
 * The Notes column, assembled.
 *
 * ⭐ Aaron: *"the notes give more context. B, body damage. like is it a chip or dent? M, PM? low
 * tire? check engine etc. available, where is it? row 1."* So for an AVAILABLE car the note is its
 * LOCATION — the column is status-dependent, not free-form-only.
 */
export function sheetNote(entry: Pick<InventoryEntry, 'status' | 'row' | 'note'>): string {
  const parts: string[] = [];
  if (entry.status === 'A') {
    const r = rowLabel(entry.row);
    if (r) parts.push(r);
  }
  const n = entry.note.trim();
  if (n) parts.push(n);
  return parts.join(' · ');
}

// ── what FG already knows ─────────────────────────────────────────────────────────────────────

/** The active holds on one car, as much of them as this module needs. */
export interface ActiveHold {
  holdType: string;
  damageDescription?: string | null;
  disposition?: string | null;
}

/**
 * ⚠️ NOT WRITTEN UP AT ALL: sale, turnback and buy-back.
 *
 * ⭐ Aaron: *"sale cars aren't written up in inventory. the one writing it down wasn't trained
 * properly"* — the `FS · for sale` row on his Sept 1 sheet is somebody else's mistake. And the rule
 * was already in FG: the closing checklist, step 1, *"no need to write down Sale or Turnback cars."*
 * Buy-backs too.
 *
 * ⭐⭐ A paper form cannot decline a row. This can, and can say why — which is the whole reason a
 * documented rule that never reached the person holding the pen is worth encoding.
 *
 * One hold type covers all three; `disposition` only names which (migration 136), so this asks the
 * question exactly once and cannot fall out of date when a fourth kind of departure appears.
 */
export function isNotWrittenUp(holds: readonly ActiveHold[]): boolean {
  return holds.some(h => h.holdType === 'sale_car');
}

/** Which kind, for the skip card's own words. Null when the car is not excluded at all. */
export function exclusionReason(holds: readonly ActiveHold[]): string | null {
  const sale = holds.find(h => h.holdType === 'sale_car');
  if (!sale) return null;
  const d = sale.disposition;
  if (isDisposition(d) && d === 'turnback') return 'Turnback';
  if (isDisposition(d) && d === 'buyback') return 'Buy-back';
  return 'Sale car';
}

export interface DerivedStatus {
  status: InventoryStatus | null;
  /** The hold's own words, when a hold decided this — so a B never arrives with an empty note. */
  note: string;
  /** Shown beside the chips: why FG picked this, or that it simply carried. */
  why: string | null;
}

/**
 * What the status should arrive as.
 *
 * ⭐⭐ THE STATUS CARRIES; IT IS NOT A DEFAULT. Aaron: *"no default. just carry the status until
 * changed. we'll generally write all available together, dirty together etc."*
 *
 * ⭐ And the reason is PHYSICAL rather than a preference: the keys are sorted into piles before the
 * write-up, and when there is a lot **two people split it** — *"one works on clean keys. the other
 * works on dirty, mechanical and body keys."* A run of one status is the normal shape of the work.
 *
 * ⚠️ I built a fixed default of `A` first, reasoning from the blanks on his sheet (*"line 3 to 27
 * are available. easier to write once instead of 'A' like 24 times"*). That was right about the
 * common case FOR THE WRONG REASON, and wrong the moment he picks up the dirty pile. The blanks were
 * never "available is the default" — they were "I was holding a pile of clean keys."
 *
 * ⚠️ A hold or a US plate OVERRIDES the carry: a damage-held car is a `B` whatever pile it came from.
 * The first car of a session carries nothing, so nothing is pre-picked and he chooses once.
 */
export function deriveStatus(
  vehicle: Pick<Vehicle, 'isUs'>,
  holds: readonly ActiveHold[],
  carried: InventoryStatus | null,
): DerivedStatus {
  const damage = holds.find(h => h.holdType === 'damage' || h.holdType === 'hail');
  if (damage) return { status: 'B', note: (damage.damageDescription ?? '').trim(), why: 'on a damage hold' };

  const mech = holds.find(h => h.holdType === 'mechanical');
  if (mech) return { status: 'M', note: (mech.damageDescription ?? '').trim(), why: 'on a mechanical hold' };

  // ⚠️ F IS ABOUT THE PLATE, NOT THE OWNING BRANCH. Aaron: *"foreign are vehicles with US plates
  // on."* I had derived it from the owning area — anything not 8199 — and his own Sept 1 sheet
  // disproves that: 840PIQ is owned by 8190 (Saskatchewan) with a BLANK status, while SSDY46, the
  // US-plated Tucson, is the one marked F. Foreign owning and foreign plate correlate and are not
  // the same thing. FG already stores `is_us`, so this needs no inference at all.
  if (vehicle.isUs) return { status: 'F', note: '', why: 'US plate' };

  return { status: carried, note: '', why: carried ? 'carried' : null };
}

// ── the running sheet ─────────────────────────────────────────────────────────────────────────

/**
 * Available cars per row, against capacity — the thing the paper cannot do.
 *
 * ⚠️ Aaron caught the first version of this on his phone: the panel showed one row while his sheet
 * held available cars in three. *"I have available cars in 3 different rows but only shows the last
 * row I used."* The carried row is what the NEXT car inherits; this is where they actually are, and
 * conflating the two put a label over a value that meant something else.
 */
export interface RowTally { row: string; label: string; count: number; capacity: number | null; full: boolean }

export function rowTally(entries: readonly InventoryEntry[]): RowTally[] {
  const by = new Map<string, number>();
  for (const e of entries) {
    if (e.status !== 'A') continue;
    const r = e.row.trim();
    if (!r) continue;
    by.set(r, (by.get(r) ?? 0) + 1);
  }
  return [...by.entries()]
    .sort((a, b) => {
      const na = Number(a[0]), nb = Number(b[0]);
      const aNum = Number.isFinite(na), bNum = Number.isFinite(nb);
      if (aNum && bNum) return na - nb;
      if (aNum) return -1;              // numbered rows first, fence zones after
      if (bNum) return 1;
      return a[0] < b[0] ? -1 : 1;
    })
    .map(([row, count]) => {
      const capacity = ROW_CAPACITY[row] ?? null;
      return { row, label: rowLabel(row), count, capacity, full: capacity !== null && count >= capacity };
    });
}

/** How the session reads at a glance. */
export function summarise(entries: readonly InventoryEntry[]) {
  const by = { A: 0, D: 0, B: 0, M: 0, F: 0 } as Record<InventoryStatus, number>;
  for (const e of entries) by[e.status]++;
  return { total: entries.length, byStatus: by };
}

/**
 * ⚠️ The paper never refuses a car, so neither does this: a vehicle FG has never seen can still be
 * entered by hand. `vehicleId` null is a legitimate row, not a broken one — the sheet is a record of
 * what was on the lot, and the lot does not check the fleet table first.
 */
export function handEntry(plate: string, status: InventoryStatus): InventoryEntry {
  return {
    vehicleId: null,
    plate: plate.trim().toUpperCase(),
    unitNumber: null, owningArea: null, rentalClass: null,
    status, row: '', note: '',
  };
}

/**
 * ⭐⭐ THE CLOSING SHEET'S TWO CARRY-OVER COUNTS, for seeding the washbay log.
 *
 * Aaron, 2026-09-05, dry-running the scanner in the lot: *"now it's all scanned then the cleans and
 * dirty should be filled out here automatically right?"* They should — and he had to spell out why,
 * because the washbay log's field names hide it:
 *
 *   *"rentable on the lot that have been cleaned but not sent to the airport / dirties are returns
 *   from the airport that are now at Erin St. this is what the morning crew will be cleaning."*
 *
 * ⚠️ So **"clean, not picked up" has always meant NOT YET SENT UP** — never "a customer failed to
 * collect it". `washbayLineage` says it outright (*"clean cars not yet sent"*) and it is still the
 * easiest field in FG to misread, because the rental meaning of the words is right there and wrong.
 *
 * **A → the cleans**, sitting at Erin St waiting for a driver to take them up.
 * **D → the queue**, airport returns that are tomorrow morning's work.
 * **B and M belong to neither** — a held car is not washbay work in either direction.
 *
 * ⚠️ AN EMPTY SHEET SEEDS NOTHING, NOT ZERO. "I did not write up a lot" is not the claim "the lot
 * was empty", and a seeded 0 would put that claim into the throughput history and into tomorrow's
 * opening card, which reads both numbers back.
 *
 * ⚠️ Erin St only. The airport closes with its OWN two counts — available cleans parked up there
 * and dirty returns in the return stalls — and FG cannot see them. This is half a branch's picture.
 */
export function seedClosingCounts(entries: readonly InventoryEntry[]): {
  queueAtClose: string; cleanNotSent: string;
} {
  if (entries.length === 0) return { queueAtClose: '', cleanNotSent: '' };
  const by = summarise(entries).byStatus;
  return { queueAtClose: String(by.D), cleanNotSent: String(by.A) };
}

/** The form's own legend order — A D B M F — so every surface reads in the order the paper does. */
export const GROUP_ORDER: readonly InventoryStatus[] = ['A', 'D', 'B', 'M', 'F'];

/** A row with the position it holds in the SHEET, which is not the position it is drawn in. */
export interface GroupedRow { entry: InventoryEntry; index: number; }
export interface EntryGroup { status: InventoryStatus; rows: readonly GroupedRow[]; }

/**
 * The sheet in piles — ONE rule, shared by the on-screen table and the copied report.
 *
 * ⭐ Aaron, 2026-09-05, after his first real 24-car sweep: *"I thought it was going to sort both my
 * scans AND the version I copy to the email."* Grouping existed, but only in the report — so the
 * table he worked from and the text he sent were two different documents. The fix is not a second
 * sort; it is one rule both call, which is also why they cannot drift apart again.
 *
 * ⚠️⚠️ EVERY ROW CARRIES ITS ORIGINAL INDEX, and callers must use it. `onEdit`/`onRemove` address
 * the sheet by position, so handing them a DISPLAY position would edit or delete a different car
 * than the one under his thumb — silently, and `Undo last` only lifts the newest row, so a wrongly
 * deleted row 3 of 40 is gone. The index is the whole reason this returns pairs and not entries.
 *
 * ⚠️ An empty status prints NOTHING, the same rule the report already held: a "BODY (0)" heading
 * would read as a claim the lot was checked for body damage and found clean, which this cannot say.
 *
 * Scan order is preserved WITHIN each pile — the sort is by status only, never by plate or class.
 */
export function groupEntries(entries: readonly InventoryEntry[]): EntryGroup[] {
  const withIndex = entries.map((entry, index) => ({ entry, index }));
  return GROUP_ORDER
    .map(status => ({ status, rows: withIndex.filter(r => r.entry.status === status) }))
    .filter(g => g.rows.length > 0);
}

/**
 * ⭐⭐ THE FLEET'S CURRENT RECORD FOR A SCANNED CAR — not the copy the scan handed over.
 *
 * ⚠️ A key-tag scan does TWO things with one read: it builds the sheet row, and it backfills the
 * blank fields on the vehicle it just resolved. The vehicle object inside a scan result is captured
 * BEFORE that write, so a row built straight from it records the car as the fleet knew it a moment
 * ago — which is exactly wrong for the car the scan just taught FG something about.
 *
 * Aaron caught it in the lot, 2026-09-05: LUR402 (unit 5426630) went on the closing sheet with a
 * BLANK owning area while its own record showed 8199, stamped `tag`, written at 21:25 by that same
 * scan. LUR401 beside it came out right for the boring reason that its owning had been on file
 * since Aug 20 — nothing to backfill, nothing to go stale. So the bug only ever shows on the thin
 * records a closing sweep is most likely to turn up.
 *
 * Falls back to the scanned copy, which is correct for a car the fleet list genuinely does not hold.
 */
export function fleetRecordFor<T extends { id: string }>(scanned: T, fleet: readonly T[]): T {
  return fleet.find(v => v.id === scanned.id) ?? scanned;
}

/** Build the row a scan produces, with the carries applied. */
export function entryFromScan(
  vehicle: Pick<Vehicle, 'id' | 'licensePlate' | 'unitNumber' | 'owningArea' | 'rentalClass' | 'isUs'>
    // ⭐ The MODEL, because a class that is not a body type (`E6`) can only be banded by looking at
    // the car. Optional so a caller that genuinely has no model still gets a suggestion from class.
    & { model?: string | null },
  holds: readonly ActiveHold[],
  carried: { status: InventoryStatus | null; row: string; filled?: Readonly<Record<string, number>> },
): { entry: InventoryEntry; why: string | null; suggestedRow: string | null } {
  const d = deriveStatus(vehicle, holds, carried.status);
  const status = d.status;
  return {
    entry: {
      vehicleId: vehicle.id,
      plate: vehicle.licensePlate,
      unitNumber: vehicle.unitNumber ?? null,
      owningArea: vehicle.owningArea ?? null,
      rentalClass: vehicle.rentalClass ?? null,
      status: status ?? 'A',
      // The row only carries for an AVAILABLE car — a dirty or held car's note is a reason, not a
      // place, and inheriting "R-5" into it would be a lie the operator has to notice and delete.
      row: status === 'A' ? carried.row : '',
      note: d.note,
    },
    why: d.why,
    suggestedRow: suggestRow(vehicle.rentalClass, carried.filled ?? {}, vehicle.model),
  };
}

/**
 * What a KEY TAG gives up about a car FG has never seen — the four columns it prints.
 *
 * ⭐⭐ Aaron, 2026-09-03: *"a plate that FG hasn't seen, why wouldn't FG just record the tag anyway.
 * then it just becomes something to fully register at another point in time."* He is right, and the
 * old behaviour was worse than a missing feature: the scanner read the whole tag, resolved no fleet
 * car, and then told him to *write it on the paper* — **throwing away four columns it had just
 * read.** The sheet never needed a fleet record; `vehicleId: null` has always been legal here.
 */
export interface TagIdentity {
  plate: string;
  /** ⭐ The tag prints make and model too — and `E6` can only be banded by the model. */
  model?: string | null;
  owningArea?: string | null;
  unitNumber?: string | null;
  rentalClass?: string | null;
}

/**
 * Build the row a tag produces for a car FG does not know.
 *
 * ⚠️ THE STATUS IS PURELY THE CARRY, and that is correct rather than lazy. `deriveStatus`'s
 * overrides need a fleet record — there are no holds on a car FG has never seen, and `F` is about
 * the PLATE being American, which the owning area cannot tell us
 * (`840PIQ` is owned by 8190 and is an `A`). So nothing is deduced; he decides, as he would on paper.
 */
export function entryFromTag(
  tag: TagIdentity,
  carried: { status: InventoryStatus | null; row: string; filled?: Readonly<Record<string, number>> },
): { entry: InventoryEntry; why: string | null; suggestedRow: string | null } {
  const status = carried.status;
  return {
    entry: {
      vehicleId: null,
      plate: tag.plate.trim().toUpperCase(),
      unitNumber: tag.unitNumber ?? null,
      owningArea: tag.owningArea ?? null,
      rentalClass: tag.rentalClass ?? null,
      status: status ?? 'A',
      row: status === 'A' ? carried.row : '',
      note: '',
    },
    why: status ? 'carried — not in the fleet' : 'not in the fleet',
    suggestedRow: suggestRow(tag.rentalClass, carried.filled ?? {}, tag.model),
  };
}

/** ⚠️ Exported for the surface: a status the operator has not chosen yet is not a row. */
export function needsStatusChoice(d: DerivedStatus): boolean {
  return d.status === null;
}
