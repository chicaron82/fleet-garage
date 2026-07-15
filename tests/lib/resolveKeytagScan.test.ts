import { describe, it, expect } from 'vitest';
import { resolveKeytagScan, newVehicleToRegisterOnScan } from '../../src/lib/resolveKeytagScan';
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
