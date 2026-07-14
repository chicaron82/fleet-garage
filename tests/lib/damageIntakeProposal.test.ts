import { describe, it, expect } from 'vitest';
import { buildDamageIntakeProposal } from '../../src/lib/damageIntakeProposal';
import type { KeytagScanResult } from '../../src/lib/resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

const fullRead: KeytagRead = {
  plate: 'LUR318', unitNumber: '5422183', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White',
};

function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1', unitNumber: '5422183', licensePlate: 'LUR318', make: 'Toyota', model: 'Corolla',
    year: 2026, color: 'White', status: 'CLEAR', branchId: 'b1', isTesla: false,
    hasMobileCable: null, hasJ1772Adapter: null, ...over,
  } as Vehicle;
}

function result(over: Partial<KeytagScanResult>): KeytagScanResult {
  return { rawPlate: 'LUR318', plate: 'LUR318', wasCorrected: false, vehicle: null, resolution: { kind: 'new' }, ...over };
}

describe('buildDamageIntakeProposal', () => {
  it('new + readable tag → register_and_hold', () => {
    const out = buildDamageIntakeProposal(fullRead, result({ resolution: { kind: 'new' } }), 'rear quarter scrape');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.proposal).toEqual({
      kind: 'register_and_hold',
      newVehicle: { unitNumber: '5422183', plate: 'LUR318', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' },
      holdType: 'damage',
      damageDescription: 'rear quarter scrape',
    });
  });

  it('new + unreadable tag (missing make) → unreadable_new fallback', () => {
    const out = buildDamageIntakeProposal({ ...fullRead, make: undefined }, result({ resolution: { kind: 'new' } }), 'scrape');
    expect(out).toEqual({ ok: false, reason: 'unreadable_new' });
  });

  it('complete → plain damage hold on the known vehicle with a label', () => {
    const out = buildDamageIntakeProposal(fullRead, result({ vehicle: vehicle(), resolution: { kind: 'complete' } }), 'bumper crack');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.proposal).toEqual({
      kind: 'hold',
      vehicle: { vehicleId: 'v1', plate: 'LUR318', label: 'Unit 5422183 · 2026 Toyota Corolla (White)' },
      holdType: 'damage',
      damageDescription: 'bumper crack',
    });
  });

  it('partial → update_and_hold carrying the blanks-only fills', () => {
    const fills = [{ field: 'model' as const, value: 'Corolla' }, { field: 'year' as const, value: 2026 }];
    const out = buildDamageIntakeProposal(
      fullRead,
      result({ vehicle: vehicle({ model: '', year: 0 }), resolution: { kind: 'partial', fills, conflicts: [] } }),
      'door ding',
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.proposal).toEqual({
      kind: 'update_and_hold', vehicleId: 'v1', plate: 'LUR318', fills, holdType: 'damage', damageDescription: 'door ding',
    });
  });

  it('defaults the hold type to damage but honours an override', () => {
    const out = buildDamageIntakeProposal(fullRead, result({ vehicle: vehicle(), resolution: { kind: 'complete' } }), 'hail dents', 'hail');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.proposal.kind === 'hold' && out.proposal.holdType).toBe('hail');
  });
});
