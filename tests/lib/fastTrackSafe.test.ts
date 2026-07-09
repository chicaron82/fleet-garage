import { describe, it, expect } from 'vitest';
import { isFastTrackSafe } from '../../src/lib/fastTrackSafe';
import type { Proposal } from '../../api/_lib/holdProposal';

const backfill: Proposal = { kind: 'update_vehicle', vehicleId: 'v1', plate: 'LUR554', fills: [{ field: 'color', value: 'Gray' }] };
const register: Proposal = { kind: 'register_vehicle', newVehicle: { unitNumber: '9001', plate: 'LUR187', make: 'Ford', model: 'Escape', year: 2024, color: 'Blue' }, isTesla: false };
const hold: Proposal = { kind: 'hold', vehicle: { vehicleId: 'v1', plate: 'LFJ438', label: 'Unit 1234' }, holdType: 'damage', damageDescription: 'scuff' };
const registerHold: Proposal = { kind: 'register_and_hold', newVehicle: { unitNumber: '9001', plate: 'LUR187', make: 'Ford', model: 'Escape', year: 2024, color: 'Blue' }, holdType: 'damage', damageDescription: 'dent' };

describe('isFastTrackSafe', () => {
  it('a backfill is fast-track-safe (blanks-only by structure)', () => {
    expect(isFastTrackSafe(backfill)).toBe(true);
  });

  it('a register is NOT fast-track-safe (needs read-confidence we do not store yet)', () => {
    expect(isFastTrackSafe(register)).toBe(false);
  });

  it('holds ALWAYS wait — never fast-track-safe', () => {
    expect(isFastTrackSafe(hold)).toBe(false);
    expect(isFastTrackSafe(registerHold)).toBe(false);
  });
});
