import { describe, it, expect } from 'vitest';
import { resolveKeytagScan, newVehicleToRegisterOnScan, backfillFieldsOnScan, keytagConflictsOnScan, conflictNote } from '../../src/lib/resolveKeytagScan';
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
    // "LMR554" is a hand-drawn-U misread of LUR554 — the snap corrects it, then it matches.
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

  it('an uncorrected unmatched plate is new, not corrected', () => {
    const read: KeytagRead = { plate: 'ABC123' }; // foreign-ish, nowhere near a known prefix
    const r = resolveKeytagScan(read, FLEET);
    expect(r.plate).toBe('ABC123');
    expect(r.wasCorrected).toBe(false);
    expect(r.vehicle).toBeNull();
    expect(r.resolution.kind).toBe('new');
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

  it('a misread MB prefix that matches the fleet after correction → null (known, not new)', () => {
    const read: KeytagRead = { plate: 'LMR554', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    expect(newVehicleToRegisterOnScan(read, FLEET)).toBeNull();
  });

  it('new plate but too partial to register (no make/model) → null', () => {
    const read: KeytagRead = { plate: 'LZM999', unitNumber: '5424999' };
    expect(newVehicleToRegisterOnScan(read, FLEET)).toBeNull();
  });

  it('no plate on the read → null', () => {
    const read: KeytagRead = { make: 'Kia', model: 'Seltos', year: 2026 };
    expect(newVehicleToRegisterOnScan(read, FLEET)).toBeNull();
  });
});

describe('backfillFieldsOnScan', () => {
  // A thin fleet record: on file, but its colour was never captured (blank). Canonical LUR
  // plate so the MB-prefix snap leaves it unchanged and it matches by plate.
  const PARTIAL_FLEET = [vehicle({ id: 'v-2', licensePlate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: '' })];

  it('on-record but partial (blank colour) + the tag has it → the fill for that vehicle', () => {
    const read: KeytagRead = { plate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver' };
    expect(backfillFieldsOnScan(read, PARTIAL_FLEET)).toEqual({
      vehicleId: 'v-2', plate: 'LUR200', fills: [{ field: 'color', value: 'Silver' }],
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

  it('a conflict-only read (tag disagrees, nothing blank) → null (never overwrites)', () => {
    const read: KeytagRead = { plate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver' };
    // vehicle already HAS a colour that disagrees → conflict, not a fill → no silent backfill
    const conflictFleet = [vehicle({ id: 'v-2', licensePlate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Black' })];
    expect(backfillFieldsOnScan(read, conflictFleet)).toBeNull();
  });
});

// ── keytagConflictsOnScan + conflictNote ─────────────────────────────────────
//
// The gap this closes (found by /reflect 47): every surface except the Holds scanner called
// backfillFieldsOnScan, which returns null for a conflict-only read — so a tag that plainly
// disagreed with the record showed the operator NOTHING. Acute for `rentalClass`, where 156
// rows were backfilled from inference and only a tag can prove one wrong.
describe('keytagConflictsOnScan', () => {
  const CLASSED: Vehicle[] = [{ ...FLEET[0], rentalClass: 'Q4' } as Vehicle];

  it('reports a field where the tag disagrees with the record', () => {
    const read = { plate: CLASSED[0].licensePlate, rentalClass: 'C' } as KeytagRead;
    const out = keytagConflictsOnScan(read, CLASSED);
    expect(out?.conflicts).toEqual([{ field: 'rentalClass', existing: 'Q4', read: 'C' }]);
  });

  it('is null when the tag agrees — no noise on the normal scan', () => {
    const read = { plate: CLASSED[0].licensePlate, rentalClass: 'Q4' } as KeytagRead;
    expect(keytagConflictsOnScan(read, CLASSED)).toBeNull();
  });

  it('is null for a car the fleet does not have', () => {
    expect(keytagConflictsOnScan({ plate: 'ZZZ999', rentalClass: 'C' } as KeytagRead, CLASSED)).toBeNull();
  });

  // The two halves are independent: a read can fill a blank AND contradict another field.
  it('reports the conflict even when there is also something to fill', () => {
    const partial: Vehicle[] = [{ ...FLEET[0], color: '', rentalClass: 'Q4' } as Vehicle];
    const read = { plate: partial[0].licensePlate, color: 'Red', rentalClass: 'C' } as KeytagRead;
    expect(backfillFieldsOnScan(read, partial)?.fills).toEqual([{ field: 'color', value: 'Red' }]);
    expect(keytagConflictsOnScan(read, partial)?.conflicts).toHaveLength(1);
  });
});

describe('conflictNote', () => {
  it('says which side is which, in words', () => {
    expect(conflictNote([{ field: 'rentalClass', existing: 'Q4', read: 'C' }]))
      .toBe('⚠️ Tag says class C (record says Q4) — open the record to correct it.');
  });

  it('is empty for no conflicts', () => {
    expect(conflictNote([])).toBe('');
  });
});
