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
