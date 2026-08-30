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
  return { rawPlate: 'LZM999', plate: 'LZM999', wasCorrected: false, vehicle: null, matchedByUnit: false, unitCandidates: [], resolution: { kind: 'new' }, ...over };
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
    expect(p.detail).toMatch(/short of make\/model\/unit\/year/);
  });

  // ⭐⭐ ...BUT THE ROW IS NO LONGER A DEAD END. Aaron, batch-uploading his camera roll on
  // 2026-08-30: *"the tag should upload, and i can add the details myself from the tag by hand."*
  // The photo rides on the proposal, so a skip with NO proposal threw it away — the model's failure
  // costing him the one artifact that hadn't failed. Now the skip carries an OFFER.
  it('⭐ offers a plate-only register so the photo survives a short read', () => {
    const p = planBatchStage({ plate: 'LZM999' }, result({}));
    expect(p.offer).toBeTruthy();
    expect(p.offer!.label).toMatch(/keeps the tag photo/);
    const nv = (p.offer!.proposal as { newVehicle: { plate: string; make: string; year: number } }).newVehicle;
    expect(nv).toMatchObject({ plate: 'LZM999', make: '', year: 0 });
  });

  // ⚠️ OFFERED, NEVER TAKEN. The plan stays a `skip` and stages nothing — the batch is exactly where
  // a misread PLATE goes unnoticed, and auto-registering would mint a junk car from one.
  it('⚠️ still reports skip — the offer is his to take, not the planner\'s', () => {
    const p = planBatchStage({ plate: 'LZM999' }, result({}));
    expect(p.action).toBe('skip');
    expect(p.proposal).toBeUndefined();
  });

  // ⚠️ No plate means nothing to register ON. That skip must stay a dead end.
  it('⚠️ offers nothing when the PLATE itself could not be read', () => {
    const p = planBatchStage({}, { ...result({}), plate: '' } as Parameters<typeof planBatchStage>[1]);
    expect(p.action).toBe('skip');
    expect(p.offer).toBeUndefined();
  });

  it('offers nothing on a car already in the fleet', () => {
    const p = planBatchStage({ plate: 'LZM999' }, result({ resolution: { kind: 'complete' } }));
    expect(p.offer).toBeUndefined();
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

// ⚠️⚠️ "NOTHING TO ADD" WAS A LIE while the scan held a photo the car did not have. The tag rode on
// the PROPOSAL and a skip has none, so every already-in-the-fleet row binned it. Aaron caught it on
// LUR143 (2026-08-30), and NINE of the twenty-six cars in that batch had no key tag on file while he
// was uploading photos of theirs. The planner reasons about FIELDS; the artifact was never in its
// model of what a scan can contribute.
describe('planBatchStage — the photo is something to add', () => {
  it('⭐ a complete car with NO key tag says it is keeping the photo', () => {
    const p = planBatchStage(FULL, result({ resolution: { kind: 'complete' }, vehicle: vehicle({ keytagPhotoUrl: null }) }));
    expect(p.action).toBe('skip');
    expect(p.detail).toBe('already in the fleet — keeping the key tag photo');
  });

  it('a complete car that already HAS one still says nothing to add', () => {
    const p = planBatchStage(FULL, result({ resolution: { kind: 'complete' }, vehicle: vehicle({ keytagPhotoUrl: 'https://cdn/kt.jpg' }) }));
    expect(p.detail).toBe('already in the fleet — nothing to add');
  });

  // The other skip branch had the same hole — a tag that only disagrees is still a tag.
  it('⭐ the disagrees-only branch keeps it too', () => {
    const p = planBatchStage(FULL, result({
      resolution: { kind: 'partial', fills: [], conflicts: [] } as never,
      vehicle: vehicle({ keytagPhotoUrl: null }),
    }));
    expect(p.detail).toBe('in the fleet; the tag only disagrees — keeping the key tag photo');
  });

  it('and says nothing to fill when the car already has one', () => {
    const p = planBatchStage(FULL, result({
      resolution: { kind: 'partial', fills: [], conflicts: [] } as never,
      vehicle: vehicle({ keytagPhotoUrl: 'https://cdn/kt.jpg' }),
    }));
    expect(p.detail).toBe('in the fleet; the tag only disagrees — nothing to fill');
  });
});
