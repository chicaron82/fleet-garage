// Cross-device reconciliation for the closing sheet — the rules that let two devices hold the same
// sheet without either one destroying the other's work. Split from `closingInventory` at the 330-line
// cap, the same way `closingInventoryLot` was; both are re-exported there so callers still see ONE
// model. Consumed by useClosingInventory (hydrate/merge) and closingInventorySync (transport).
import type { InventoryEntry } from './closingInventory';
import { normalizePlate } from './fleetAudit';

/** The rows anything outside the store/sync/hook is allowed to see — tombstones are internal. */
export function visibleEntries(all: readonly InventoryEntry[]): InventoryEntry[] {
  return all.filter(e => !e.deleted);
}

/** Only the identity a heal can copy across. Deliberately narrow so tests need no whole Vehicle. */
export interface LinkableCar {
  id: string;
  licensePlate: string;
  unitNumber?: string | null;
  owningArea?: string | null;
  rentalClass?: string | null;
  archivedAt?: string | null;
}

/**
 * ⭐ Adopt any hand-typed row whose car FG now knows — the seam in Aaron's own workflow.
 *
 * ⚠️ THE FAILURE THIS CLOSES (2026-09-12). His rule: *"if i come across a car FG hasn't seen, then i
 * scan them after rather then waiting for it to show up again to backfill the rest of the data."* So
 * during a write-up he hits a car FG does not have, types it onto the sheet (`handEntry` → every
 * identity field null), and registers it seconds later. **Nothing went back for the row.** `LUR479`
 * and `MCN138` were registered at 22:41 and 22:45 and their sheet rows were still orphaned four
 * hours on — invisible, because a sheet with an unlinked row looks exactly like a complete one.
 *
 * ⭐ HEALING FROM THE FLEET RATHER THAN FROM THE REGISTRATION is the whole design choice. Hooking
 * `addVehicle` would fix only cars HE mints, in one code path, and would staple a write helper to a
 * screen it has no business knowing about. Deriving it here fixes the row no matter how the car
 * arrived — his scan, someone else's, a later import — and re-heals on every hydrate for free.
 *
 * ⚠️ Matches on the PLATE, and on the unit only as a fallback: `handEntry` leaves `unitNumber` null,
 * so the plate is the only key most orphans have. An ambiguous plate (two live cars, one string) is
 * left alone rather than guessed — the same rule the VIN backfill runs on: collisions are reported,
 * never resolved.
 *
 * ⚠️ `at` MOVES on a healed row, and it has to. `sameEntries` compares id and `at` alone, so a heal
 * that left the clock untouched would be invisible to the hook and never persist; and the healed row
 * strictly knows more than the orphan it replaces, so it SHOULD win a cross-device merge. Idempotent
 * regardless — a row with a `vehicleId` is skipped, so this cannot ping-pong between two devices.
 */
export function linkUnlinked(
  all: readonly InventoryEntry[],
  fleet: readonly LinkableCar[],
  now: number = Date.now(),
): InventoryEntry[] {
  const orphans = all.filter(e => !e.deleted && !e.vehicleId);
  if (orphans.length === 0) return all as InventoryEntry[];

  const byPlate = new Map<string, LinkableCar | null>();   // null marks an ambiguous key
  const byUnit = new Map<string, LinkableCar | null>();
  for (const car of fleet) {
    if (car.archivedAt) continue;                          // an archived car never adopts a live row
    const p = normalizePlate(car.licensePlate);
    if (p) byPlate.set(p, byPlate.has(p) ? null : car);
    const u = (car.unitNumber ?? '').trim();
    if (u) byUnit.set(u, byUnit.has(u) ? null : car);
  }

  let changed = false;
  const out = all.map(e => {
    if (e.deleted || e.vehicleId) return e;
    const unit = (e.unitNumber ?? '').trim();
    const car = byPlate.get(normalizePlate(e.plate)) ?? (unit ? byUnit.get(unit) : null);
    if (!car) return e;                                    // unknown, or ambiguous → leave it alone
    changed = true;
    return {
      ...e,
      at: now,
      vehicleId: car.id,
      plate: car.licensePlate,                             // FG's spelling wins once it owns the row
      unitNumber: e.unitNumber ?? car.unitNumber ?? null,
      owningArea: e.owningArea ?? car.owningArea ?? null,
      rentalClass: e.rentalClass ?? car.rentalClass ?? null,
    };
  });
  return changed ? out : (all as InventoryEntry[]);
}

/**
 * ⭐⭐ MERGE PER ROW, NEVER WHOLE-LIST. Mirrors `mergeFlipRows` deliberately — same problem, same
 * shape, and the flip's version is the one that survived a real defect (`b93ccda`).
 *
 * ⚠️ Whole-list last-write-wins is not merely coarser here, it is DESTRUCTIVE: a PC opened at home
 * holds an empty sheet, and the moment it wrote, 24 cars scanned at the yard would be gone. Per-row,
 * an empty side simply contributes nothing.
 *
 * Order: this device's rows keep their positions — the sheet must not reshuffle under him mid-pile
 * — and rows only the server had are appended. Idempotent and commutative, which is what makes
 * re-pulling on every refocus safe.
 */
export function mergeEntries(local: readonly InventoryEntry[], server: readonly InventoryEntry[]): InventoryEntry[] {
  const winner = new Map<string, InventoryEntry>();
  for (const e of local) winner.set(e.id, e);
  for (const e of server) {
    const mine = winner.get(e.id);
    // Strictly-newer wins, so a tie keeps local. A same-millisecond edit on two devices is not a
    // case worth a clock-skew tiebreaker.
    if (!mine || e.at > mine.at) winner.set(e.id, e);
  }
  const merged = local.map(e => winner.get(e.id) ?? e);
  const known = new Set(local.map(e => e.id));
  for (const e of server) if (!known.has(e.id)) merged.push(winner.get(e.id) ?? e);
  return merged;
}

/** Same rows at the same versions? Lets a hydrate skip a pointless write, so two devices cannot
 *  ping-pong reconciliations at each other. */
export function sameEntries(a: readonly InventoryEntry[], b: readonly InventoryEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((e, i) => e.id === b[i].id && e.at === b[i].at);
}
