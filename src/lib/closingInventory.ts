import type { Vehicle } from '../types';
import { isDisposition } from './disposition';

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

// ── the rows ──────────────────────────────────────────────────────────────────────────────────
//
// Erin St, from Aaron 2026-09-02 and the hand-drawn lot map. Rows 1–5 stage FOR THE AIRPORT and are
// banded by class; row 6 is Erin St's own reservations; 7–12 are overflow and where some held cars
// sit. See the memory `reference_erin_st_lot_rows` for the map's full vocabulary (numbered stalls,
// the 6+ strip, the BR/FF fence zones, and the south fence being where dirties live).

/** Row → how many cars it holds. Used for the live tally, never to refuse a row. */
export const ROW_CAPACITY: Readonly<Record<string, number>> = {
  '1': 8, '2': 8, '3': 8, '4': 8, '5': 8, '6': 8,
  '7': 4, '8': 4, '9': 4, '10': 4, '11': 4, '12': 4,
};

/**
 * ⚠️⚠️ EXACT MATCH ON THE WHOLE CLASS STRING. NEVER A PREFIX.
 *
 * ⭐ Aaron, reading his own lot map back to me: *"B5 is a crossover. someone lumped it in with B
 * because it shares a letter."* A person already made this mistake in pencil, years ago, and it has
 * been wrong on the wall ever since. A `startsWith` would reproduce it in TypeScript.
 *
 * ⭐ And the counter-case proves the rule rather than weakening it: `L` and `L2` ARE both large SUVs
 * (L2 is the 6–7 seater) — so a prefix match would have got `L2` right BY LUCK and `B5` wrong by the
 * same rule. Both are listed by their whole name because both were ASKED about.
 */
/**
 * ⭐⭐ HIS SIMPLE VERSION, which is the real rule — *"simple version of the rows, without having to
 * remember classes: 1 large vehicles/premiums · 2 and 3 SUV style · 4 and 5 sedans and small
 * vehicles · 6 erin st reservations."* The bands are about the CAR, not the code; the class lists
 * below are just how FG recognises which band a car is in.
 *
 * ⭐ A BAND IS SEVERAL ROWS, and which one a car sits in is a FILL question, not a class question —
 * R2 and R3 hold the same thing, so the second only starts when the first is full. That is why this
 * returns an ordered band rather than one row.
 */
const BANDS: readonly { rows: readonly string[]; classes: readonly string[]; label: string }[] = [
  // Minivans (R), F-150s (S), the T family, and O6 — *"naturally an O6 midsize truck is parked
  // where the other trucks are parked. row 1"*. "T's on the map are on 1, covers T, T4, T6."
  { rows: ['1'], classes: ['R', 'S', 'T', 'T4', 'T6', 'O6'], label: 'large / premium' },
  { rows: ['2', '3'], classes: ['B4', 'B5', 'Q4', 'L', 'L2'], label: 'SUV style' },
  // ⭐ "B, C, F, sedans. compact, mid-size, full size." And "small vehicles" is what resolves B —
  // it holds a Kona, a Versa and a Corolla Hatchback, three body types that are all SMALL. The
  // ambiguity I flagged in that class was mine, not the lot's.
  { rows: ['4', '5'], classes: ['B', 'C', 'F'], label: 'sedans / small' },
];

/**
 * Which row a class usually sits in — a SUGGESTION, never a decision.
 *
 * ⭐ It works at all because he parks by class in the first place (closing checklist step 2: *"put
 * clean cars on their designated row/ring, load from the back"*), so the suggestion is usually
 * already right about a car he has already parked.
 *
 * ⚠️⚠️ AN UNBANDED CLASS RETURNS NULL, AND THAT IS CORRECT RATHER THAN TIMID — because a rental
 * class is not necessarily a body type at all:
 *   • `E6` is the HYBRID class (FG already knows: `HYBRID_RENTAL_CLASSES`). Its 43 cars are Civic,
 *     Camry, Corolla, Prius — AND Sportage and RAV4. A hybrid Camry is a sedan and a hybrid RAV4 is
 *     an SUV, so E6 has no single row and never will.
 *   • The Volvos (`W4` `Z4` `H4`), the Teslas (`E7` `E8` `B9` `E9`), `E1` and `V` are simply not
 *     banded yet — "premiums" is in row 1's description and a subcompact XC40 is not obviously a
 *     row-1 car, so this waits for an answer instead of inventing one.
 * Measured across the live fleet 2026-09-02; see the memory `reference_erin_st_lot_rows`.
 */
export function suggestBand(rentalClass: string | null | undefined): readonly string[] | null {
  const c = (rentalClass ?? '').trim().toUpperCase();
  if (!c) return null;
  return BANDS.find(b => b.classes.includes(c))?.rows ?? null;
}

/**
 * The row to actually suggest: the first in the band with space left.
 *
 * ⚠️ Fill is counted from THIS SESSION only, so it is a hint about what he has already written down
 * tonight — not a claim about the lot. A row can be full of cars he has not scanned yet, and the
 * suggestion being wrong costs one tap.
 */
export function suggestRow(
  rentalClass: string | null | undefined,
  filled: Readonly<Record<string, number>> = {},
): string | null {
  const band = suggestBand(rentalClass);
  if (!band) return null;
  for (const r of band) {
    const cap = ROW_CAPACITY[r];
    if (cap === undefined || (filled[r] ?? 0) < cap) return r;
  }
  return band[band.length - 1];   // every row in the band is full — still name the band's last
}

/** "R-5" for a numbered row; a fence zone or stall ("SF", "BR-2A", "8-3") passes through as-is. */
export function rowLabel(row: string | null | undefined): string {
  const r = (row ?? '').trim();
  if (!r) return '';
  return /^\d+$/.test(r) ? `R-${r}` : r.toUpperCase();
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

/** Build the row a scan produces, with the carries applied. */
export function entryFromScan(
  vehicle: Pick<Vehicle, 'id' | 'licensePlate' | 'unitNumber' | 'owningArea' | 'rentalClass' | 'isUs'>,
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
    suggestedRow: suggestRow(vehicle.rentalClass, carried.filled ?? {}),
  };
}

/** ⚠️ Exported for the surface: a status the operator has not chosen yet is not a row. */
export function needsStatusChoice(d: DerivedStatus): boolean {
  return d.status === null;
}
