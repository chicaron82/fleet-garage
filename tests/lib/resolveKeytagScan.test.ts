import { describe, it, expect } from 'vitest';
import { resolveKeytagScan, newVehicleToRegisterOnScan, backfillFieldsOnScan, keytagConflictsOnScan, conflictNote, changeNote, fillNote } from '../../src/lib/resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

function vehicle(over: Partial<Vehicle>): Vehicle {
  return {
    id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554',
    make: 'Buick', model: 'Envista', year: 2026, color: 'Gray',
    status: 'CLEAR', branchId: 'YWG', isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
    ...over,
  };
}

const FLEET = [vehicle({ id: 'v-1', licensePlate: 'LUR554' })];

describe('resolveKeytagScan', () => {
  it('plate not in the fleet → new', () => {
    const read: KeytagRead = { plate: 'LZM999', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray' };
    const r = resolveKeytagScan(read, FLEET);
    expect(r.plate).toBe('LZM999');
    expect(r.vehicle).toBeNull();
    expect(r.resolution.kind).toBe('new');
  });

  it('plate in the fleet, read matches → complete, returns the vehicle', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const r = resolveKeytagScan(read, FLEET);
    expect(r.vehicle?.id).toBe('v-1');
    expect(r.resolution.kind).toBe('complete');
  });

  it('a misread MB prefix is corrected before matching (LMR→LUR), and matches the fleet', () => {
    const read: KeytagRead = { plate: 'LMR554', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const r = resolveKeytagScan(read, FLEET);
    expect(r.plate).toBe('LUR554');
    expect(r.wasCorrected).toBe(true);
    expect(r.vehicle?.id).toBe('v-1');
    expect(r.resolution.kind).toBe('complete');
  });

  it('in fleet but partial (fleet missing a field the tag has) → partial with the fill', () => {
    const sparse = [vehicle({ id: 'v-1', licensePlate: 'LUR554', model: '', year: 0 })];
    const read: KeytagRead = { plate: 'LUR554', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const r = resolveKeytagScan(read, sparse);
    expect(r.resolution.kind).toBe('partial');
    if (r.resolution.kind !== 'partial') return;
    expect(r.resolution.fills.map(f => f.field).sort()).toEqual(['model', 'year']);
  });

  it('a locked field feeds through from the vehicle field_sources → conflict, not change', () => {
    // The vehicle's colour was manually set → a disagreeing tag is blocked.
    const locked = [vehicle({ id: 'v-1', licensePlate: 'LUR554', color: 'Gray', fieldSources: { color: 'manual' } })];
    const read: KeytagRead = { plate: 'LUR554', color: 'Blue' };
    const r = resolveKeytagScan(read, locked);
    expect(r.resolution.kind).toBe('partial');
    if (r.resolution.kind !== 'partial') return;
    expect(r.resolution.changes).toEqual([]);
    expect(r.resolution.conflicts).toEqual([{ field: 'color', existing: 'Gray', read: 'Blue' }]);
  });
});

describe('newVehicleToRegisterOnScan', () => {
  it('new plate + full read → the NewVehicle to register (movement scan adds it)', () => {
    const read: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    expect(newVehicleToRegisterOnScan(read, FLEET)).toEqual({
      unitNumber: '5424315', plate: 'LUR315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White',
    });
  });

  it('already in the fleet → null (nothing to register)', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    expect(newVehicleToRegisterOnScan(read, FLEET)).toBeNull();
  });

  it('new plate but too partial to register (no make/model) → null', () => {
    const read: KeytagRead = { plate: 'LZM999', unitNumber: '5424999' };
    expect(newVehicleToRegisterOnScan(read, FLEET)).toBeNull();
  });
});

describe('backfillFieldsOnScan', () => {
  const PARTIAL_FLEET = [vehicle({ id: 'v-2', licensePlate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: '' })];

  it('on-record but partial (blank colour) + the tag has it → the fill for that vehicle', () => {
    const read: KeytagRead = { plate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver' };
    expect(backfillFieldsOnScan(read, PARTIAL_FLEET)).toEqual({
      vehicleId: 'v-2', plate: 'LUR200',
      applies: [{ field: 'color', value: 'Silver' }],
      fills: [{ field: 'color', value: 'Silver' }],
      changes: [],
    });
  });

  it('new vehicle → null (registration handles it, not backfill)', () => {
    const read: KeytagRead = { plate: 'LUR777', make: 'Ford', model: 'Escape', year: 2025, color: 'Blue' };
    expect(backfillFieldsOnScan(read, PARTIAL_FLEET)).toBeNull();
  });

  it('complete record (the tag adds nothing) → null', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    expect(backfillFieldsOnScan(read, FLEET)).toBeNull();
  });

  it('UNLOCKED disagreement → a CHANGE that gets applied (the self-heal; no longer null)', () => {
    // The car has a colour that disagrees, but it was never manually locked → the tag corrects it.
    const conflictFleet = [vehicle({ id: 'v-2', licensePlate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Black' })];
    const read: KeytagRead = { plate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver' };
    const out = backfillFieldsOnScan(read, conflictFleet);
    expect(out?.applies).toEqual([{ field: 'color', value: 'Silver' }]);
    expect(out?.changes).toEqual([{ field: 'color', from: 'Black', value: 'Silver' }]);
    expect(out?.fills).toEqual([]);
  });

  it('LOCKED disagreement → null from backfill (blocked, not applied)', () => {
    const lockedFleet = [vehicle({ id: 'v-2', licensePlate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Black', fieldSources: { color: 'manual' } })];
    const read: KeytagRead = { plate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver' };
    expect(backfillFieldsOnScan(read, lockedFleet)).toBeNull();
  });
});

// ── keytagConflictsOnScan + notes: a conflict now requires a LOCKED (manual) field ─────────────
describe('keytagConflictsOnScan', () => {
  // rentalClass manually set → locked. A disagreeing tag is a conflict.
  const LOCKED: Vehicle[] = [vehicle({ rentalClass: 'E6', fieldSources: { rentalClass: 'manual' } })];

  it('reports a field where the tag disagrees with a MANUALLY-SET (locked) value', () => {
    const read = { plate: LOCKED[0].licensePlate, rentalClass: 'F' } as KeytagRead;
    const out = keytagConflictsOnScan(read, LOCKED);
    expect(out?.conflicts).toEqual([{ field: 'rentalClass', existing: 'E6', read: 'F' }]);
  });

  it('an UNLOCKED (inferred) class that disagrees is a change, NOT a conflict → null here', () => {
    const inferred: Vehicle[] = [vehicle({ rentalClass: 'Q4' })]; // no field_sources → overwritable
    const read = { plate: inferred[0].licensePlate, rentalClass: 'C' } as KeytagRead;
    expect(keytagConflictsOnScan(read, inferred)).toBeNull();
  });

  it('is null when the tag agrees — no noise on the normal scan', () => {
    const read = { plate: LOCKED[0].licensePlate, rentalClass: 'E6' } as KeytagRead;
    expect(keytagConflictsOnScan(read, LOCKED)).toBeNull();
  });

  it('is null for a car the fleet does not have', () => {
    expect(keytagConflictsOnScan({ plate: 'ZZZ999', rentalClass: 'C' } as KeytagRead, LOCKED)).toBeNull();
  });
});

describe('conflictNote (blocked — the operator\'s edit wins)', () => {
  it('says the tag disagrees but the manual edit is kept', () => {
    expect(conflictNote([{ field: 'rentalClass', existing: 'E6', read: 'F' }]))
      .toBe('⚠️ Tag says class F — your edit (E6) kept');
  });

  it('is empty for no conflicts', () => {
    expect(conflictNote([])).toBe('');
  });
});

describe('changeNote (applied — the tag corrected a stale value)', () => {
  it('says what was updated, old → new', () => {
    expect(changeNote([{ field: 'rentalClass', from: 'Q4', value: 'C' }]))
      .toBe('↻ Updated from tag: class Q4 → C');
  });

  it('is empty for no changes', () => {
    expect(changeNote([])).toBe('');
  });
});

// ⭐ *"this scan backfilled data"* — Aaron's own example of a toast worth having, and the third
// sibling of changeNote/conflictNote. A RECEIPT: what happened to the record while he held the tag.
describe('fillNote', () => {
  it('names the fields in FG\'s own words, not the code\'s', () => {
    expect(fillNote([{ field: 'unitNumber', value: '5422795' }, { field: 'rentalClass', value: 'C' }]))
      .toBe('filled unit, class');
  });

  // ⚠️⚠️ THE GAP THAT SHIPPED: the toast built this half by joining raw f.field, so a real scan read
  // "filled unitNumber, rentalClass · ↻ Updated from tag: class Q4 → C" — one sentence, two
  // vocabularies, with `class` and `rentalClass` naming the same thing four words apart.
  it('covers the three fields the label map used to miss', () => {
    expect(fillNote([
      { field: 'owningArea', value: '8199' },
      { field: 'classCode', value: 'CKNE' },
      { field: 'vinLast9', value: '123456789' },
    ])).toBe('filled owning area, model code, VIN');
  });

  // ⚠️ THE IMPORTANT CASE. A car FG already knew completely produces NO line — "you scanned a car"
  // is not news, and a signal spent on every scan is a signal gone by next week.
  it('says nothing when the scan revealed nothing', () => {
    expect(fillNote([])).toBe('');
  });
});

// ⭐⭐ TYPING A UNIT NUMBER. Aaron, 2026-09-04: *"plate may be unreadable but you can still look up
// the unit right? how does the header scanner work. just plate only?"* — the resolver has matched on
// the unit since it was written; the manual path just never handed it one, always building a plate.
// These pin the resolver's half of that contract.
describe('resolving by unit number alone', () => {
  const fleet = [
    { id: 'v1', licensePlate: 'LUR306', unitNumber: '5422795', make: 'Kia', model: 'Forte', year: 2026 },
    { id: 'v2', licensePlate: 'LFJ400', unitNumber: '5426408', make: 'Kia', model: 'Rio', year: 2025 },
  ] as unknown as Vehicle[];

  it('finds the car and says the UNIT is what did it', () => {
    const r = resolveKeytagScan({ unitNumber: '5426408' } as KeytagRead, fleet);
    expect(r.vehicle?.licensePlate).toBe('LFJ400');
    expect(r.matchedByUnit).toBe(true);
  });

  // ⚠️ FG never resolves on a weaker key without saying so — a plate match is not "by unit".
  it('does not claim a unit match when the plate found it', () => {
    const r = resolveKeytagScan({ plate: 'LUR306', unitNumber: '5422795' } as KeytagRead, fleet);
    expect(r.vehicle?.licensePlate).toBe('LUR306');
    expect(r.matchedByUnit).toBe(false);
  });

  it('finds nothing for a unit the fleet does not carry', () => {
    const r = resolveKeytagScan({ unitNumber: '9999999' } as KeytagRead, fleet);
    expect(r.vehicle).toBeNull();
    expect(r.matchedByUnit).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// FTR2260 · unit 5627245 — the tag printed with the perforation through its LEFT COLUMN, so every
// line lost its first character. Aaron entered this car's details by hand from the barcode sticker
// and the physical plate, and FG argued with him on every scan:
// *"each time i scan this tag it either asks me to register it or asks if its a replate."*
describe('the clipped tag — a perforation through the label’s left column', () => {
  const K4 = vehicle({ id: 'k4', licensePlate: 'FTR2260', unitNumber: '5627245' });
  const FLEET_K4 = [K4, vehicle({ id: 'other', licensePlate: 'LZM500', unitNumber: '5421615' })];
  /** What the reader gets back when the leading character of every line is gone. */
  const CLIPPED: KeytagRead = { plate: 'TR2260', unitNumber: '627245', vinLast9: 'SE150006' };

  it('⭐⭐ resolves to the right car instead of offering to register it', () => {
    const r = resolveKeytagScan(CLIPPED, FLEET_K4);
    expect(r.vehicle?.id).toBe('k4');
    expect(r.resolution.kind).not.toBe('new');
  });

  it('⭐ says which key did the work — never a silent resolve by a weaker key', () => {
    expect(resolveKeytagScan(CLIPPED, FLEET_K4).matchedByClippedTag).toBe(true);
  });

  // ⚠️⚠️ THE GUARD. Suffix matching on every failed scan would be a standing invitation to attach a
  // read to the wrong car. It is earned from the read itself — two fixed-length fields, each
  // exactly one short — and a scan that merely fluffed a digit must get nothing from it.
  it('⚠️⚠️ an ordinary bad read does NOT get suffix matching', () => {
    const r = resolveKeytagScan({ plate: 'TR2260', unitNumber: '627245', vinLast9: '2SE150006' }, FLEET_K4);
    expect(r.vehicle).toBeNull();
    expect(r.matchedByClippedTag).toBe(false);
  });

  // ⚠️ An exact hit always wins, so a tag that resolves today keeps resolving to the same car.
  it('⚠️ never overrides an exact plate match', () => {
    const r = resolveKeytagScan({ plate: 'LZM500', unitNumber: '627245', vinLast9: 'SE150006' }, FLEET_K4);
    expect(r.vehicle?.id).toBe('other');
    expect(r.matchedByClippedTag).toBe(false);
  });

  it('⚠️ never overrides an exact unit match', () => {
    const r = resolveKeytagScan({ plate: 'TR2260', unitNumber: '5627245', vinLast9: 'SE150006' }, FLEET_K4);
    expect(r.vehicle?.id).toBe('k4');
    expect(r.matchedByUnit).toBe(true);
    expect(r.matchedByClippedTag).toBe(false);
  });

  // ⚠️⚠️ LUR271 and KUR271 are both live today and both end UR271. Measuring "zero suffix collisions
  // across 762 units" proves the rule is exact on TODAY's fleet; it does not make it exact by
  // construction, and the cost of being wrong is a scan attached to the wrong car.
  it('⚠️⚠️ hands back both candidates when the restored character is ambiguous', () => {
    const twins = [
      vehicle({ id: 'l', licensePlate: 'LUR271', unitNumber: '5420001' }),
      vehicle({ id: 'k', licensePlate: 'KUR271', unitNumber: '6420001' }),
    ];
    const r = resolveKeytagScan({ plate: 'UR271', unitNumber: '420001', vinLast9: 'SE150006' }, twins);
    expect(r.vehicle).toBeNull();
    expect(r.unitCandidates.map(v => v.id)).toEqual(['l', 'k']);
  });

  // ⭐ THE STRONGER KEY RESCUES THE WEAKER ONE, and this is the live LUR271/KUR271 shape: their
  // PLATES are ambiguous once clipped (both end UR271) while their units are not. Unit is tried
  // first precisely so that this resolves rather than stalling — the same precedence the exact
  // passes use, for the same reason (~97.5% vs ~87.5%).
  it('⭐ an ambiguous clipped PLATE still resolves when the clipped unit is unique', () => {
    const twins = [
      vehicle({ id: 'l', licensePlate: 'LUR271', unitNumber: '5420001' }),
      vehicle({ id: 'k', licensePlate: 'KUR271', unitNumber: '5420002' }),
    ];
    const r = resolveKeytagScan({ plate: 'UR271', unitNumber: '420001', vinLast9: 'SE150006' }, twins);
    expect(r.vehicle?.id).toBe('l');
    expect(r.matchedByClippedTag).toBe(true);
  });

  it('falls back to the PLATE when the clipped unit finds nothing', () => {
    const r = resolveKeytagScan({ plate: 'TR2260', unitNumber: '999999', vinLast9: 'SE150006' }, FLEET_K4);
    expect(r.vehicle?.id).toBe('k4');
    expect(r.matchedByClippedTag).toBe(true);
  });

  it('a clipped read for a car FG genuinely does not have is still new', () => {
    const r = resolveKeytagScan(CLIPPED, [vehicle({ id: 'x', licensePlate: 'LZM500', unitNumber: '5421615' })]);
    expect(r.vehicle).toBeNull();
    expect(r.matchedByClippedTag).toBe(false);
  });
});
