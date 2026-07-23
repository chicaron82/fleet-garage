import { describe, it, expect } from 'vitest';
import { planBatchStage } from '../../src/lib/planBatchStage';
import type { KeytagScanResult } from '../../src/lib/resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

const FULL: KeytagRead = { plate: 'LZM999', unitNumber: '5423827', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray' };

function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554', make: 'Buick', model: 'Envista',
    year: 2026, color: 'Gray', status: 'CLEAR', branchId: 'YWG', isTesla: false,
    hasMobileCable: null, hasJ1772Adapter: null, ...over,
  };
}

function result(over: Partial<KeytagScanResult>): KeytagScanResult {
  return { rawPlate: 'LZM999', plate: 'LZM999', wasCorrected: false, vehicle: null, resolution: { kind: 'new' }, ...over };
}

describe('planBatchStage', () => {
  it('new + a complete read → stages a register', () => {
    const p = planBatchStage(FULL, result({}));
    expect(p.action).toBe('register');
    expect(p.proposal).toEqual({
      kind: 'register_vehicle',
      newVehicle: { unitNumber: '5423827', plate: 'LZM999', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray' },
      isTesla: false,
    });
  });

  it('a Tesla read flags isTesla on the register', () => {
    const p = planBatchStage({ ...FULL, make: 'Tesla', model: 'Model 3' }, result({}));
    expect(p.action).toBe('register');
    expect(p.proposal).toMatchObject({ kind: 'register_vehicle', isTesla: true });
  });

  it('new but an incomplete read → skip (needs the missing fields)', () => {
    const p = planBatchStage({ plate: 'LZM999' }, result({}));
    expect(p.action).toBe('skip');
    expect(p.detail).toMatch(/couldn't read enough/);
  });

  it('complete match → skip, nothing to add', () => {
    const p = planBatchStage({ plate: 'LUR554' }, result({ plate: 'LUR554', vehicle: vehicle(), resolution: { kind: 'complete' } }));
    expect(p.action).toBe('skip');
    expect(p.detail).toMatch(/already in the fleet/);
  });

  it('partial with fills → stages a backfill of the blank fields', () => {
    const v = vehicle({ model: '', year: 0 });
    const p = planBatchStage({ plate: 'LUR554', model: 'Envista', year: 2026 }, result({
      plate: 'LUR554', vehicle: v,
      resolution: { kind: 'partial', fills: [{ field: 'model', value: 'Envista' }, { field: 'year', value: 2026 }], changes: [], conflicts: [] },
    }));
    expect(p.action).toBe('backfill');
    expect(p.proposal).toEqual({
      kind: 'update_vehicle', vehicleId: 'v-1', plate: 'LUR554',
      fills: [{ field: 'model', value: 'Envista' }, { field: 'year', value: 2026 }],
    });
  });

  it('partial with only conflicts (no fills) → skip, nothing to fill', () => {
    const v = vehicle();
    const p = planBatchStage({ plate: 'LUR554', model: 'Sorento' }, result({
      plate: 'LUR554', vehicle: v,
      resolution: { kind: 'partial', fills: [], changes: [], conflicts: [{ field: 'model', existing: 'Envista', read: 'Sorento' }] },
    }));
    expect(p.action).toBe('skip');
    expect(p.detail).toMatch(/only disagrees/);
  });

  it('an unreadable plate → skip (scan it alone)', () => {
    const p = planBatchStage({ unitNumber: '5423827' }, result({ plate: '', rawPlate: undefined }));
    expect(p.action).toBe('skip');
    expect(p.detail).toMatch(/couldn't read the plate/);
  });

  it('carries the misread-correction show-your-work through', () => {
    const p = planBatchStage({ plate: 'LMR554' }, result({ rawPlate: 'LMR554', plate: 'LUR554', wasCorrected: true, resolution: { kind: 'new' } }));
    expect(p.wasCorrected).toBe(true);
    expect(p.rawPlate).toBe('LMR554');
    expect(p.plate).toBe('LUR554');
  });
});
