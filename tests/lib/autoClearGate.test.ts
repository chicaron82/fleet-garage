import { describe, it, expect } from 'vitest';
import { passesDeterministicAutoClear } from '../../src/lib/autoClearGate';
import type { Proposal } from '../../api/_lib/holdProposal';

const backfill: Proposal = { kind: 'update_vehicle', vehicleId: 'v1', plate: 'LUR554', fills: [{ field: 'color', value: 'Gray' }] };
const register: Proposal = { kind: 'register_vehicle', newVehicle: { unitNumber: '9001', plate: 'LUR187', make: 'Ford', model: 'Escape', year: 2024, color: 'Blue' }, isTesla: false };
const hold: Proposal = { kind: 'hold', vehicle: { vehicleId: 'v1', plate: 'LFJ438', label: 'Unit 1234' }, holdType: 'damage', damageDescription: 'scuff' };

describe('passesDeterministicAutoClear', () => {
  it('a backfill with a clean plate read WOULD auto-clear', () => {
    expect(passesDeterministicAutoClear(backfill, { plateCorrected: false })).toBe(true);
  });

  it('a backfill whose plate needed a prefix correction would NOT (lower-confidence read)', () => {
    expect(passesDeterministicAutoClear(backfill, { plateCorrected: true })).toBe(false);
  });

  it('a register never auto-clears, even on a clean read', () => {
    expect(passesDeterministicAutoClear(register, { plateCorrected: false })).toBe(false);
  });

  it('a hold never auto-clears', () => {
    expect(passesDeterministicAutoClear(hold, { plateCorrected: false })).toBe(false);
  });
});
