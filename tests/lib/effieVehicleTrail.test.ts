import { describe, it, expect } from 'vitest';
import { proposalTarget, effieWritesForVehicle, describeEffieWrite, type EffieWriteLike }
  from '../../src/lib/effieVehicleTrail';
import type { Proposal } from '../../api/_lib/holdProposal';

const row = (id: string, kind: string, proposal: unknown, createdAt = '2026-08-01T00:00:00Z'): EffieWriteLike => ({
  id, kind, proposal: proposal as Proposal, source: 'effie-chat', status: 'approved',
  createdAt, resolvedAt: createdAt, proposedBy: 'u-effie', resolvedBy: 'u-aaron',
});

describe('proposalTarget', () => {
  it('reads vehicleId + plate off an update proposal', () => {
    expect(proposalTarget({ kind: 'update_vehicle', vehicleId: 'v1', plate: 'lur132', fills: [] } as unknown as Proposal))
      .toEqual({ vehicleId: 'v1', plate: 'LUR132' });
  });

  it('reads the nested vehicle off a hold proposal', () => {
    expect(proposalTarget({ kind: 'hold', vehicle: { vehicleId: 'v2', plate: 'LJF 684', label: 'x' } } as unknown as Proposal))
      .toEqual({ vehicleId: 'v2', plate: 'LJF684' });
  });

  // ⚠️ THE CASE THE WHOLE PLATE MATCH EXISTS FOR. A register proposal describes a car that did not
  // exist when Effie proposed it — the id is minted on approval, so it can never be in the payload.
  it('⭐ finds a register proposal by plate, because it has no vehicleId to find', () => {
    const t = proposalTarget({ kind: 'register_vehicle', newVehicle: { plate: 'lfj400' }, isTesla: false } as unknown as Proposal);
    expect(t).toEqual({ vehicleId: null, plate: 'LFJ400' });
  });

  it('handles register_and_hold the same way', () => {
    expect(proposalTarget({ kind: 'register_and_hold', newVehicle: { plate: 'XH505T' } } as unknown as Proposal).plate)
      .toBe('XH505T');
  });

  it('reads licensePlate off a lost_item proposal', () => {
    expect(proposalTarget({ kind: 'lost_item', licensePlate: 'lur126', description: 'sunglasses' } as unknown as Proposal).plate)
      .toBe('LUR126');
  });

  it('returns an empty target for a proposal with no vehicle in it', () => {
    expect(proposalTarget({ kind: 'navigate', to: 'holds' } as unknown as Proposal))
      .toEqual({ vehicleId: null, plate: '' });
    expect(proposalTarget(null)).toEqual({ vehicleId: null, plate: '' });
    expect(proposalTarget(undefined)).toEqual({ vehicleId: null, plate: '' });
  });
});

describe('effieWritesForVehicle', () => {
  const held = row('a', 'hold', { kind: 'hold', vehicle: { vehicleId: 'v1', plate: 'LUR132' } }, '2026-08-02T00:00:00Z');
  const registered = row('b', 'register_vehicle', { kind: 'register_vehicle', newVehicle: { plate: 'LUR132' } }, '2026-08-05T00:00:00Z');
  const other = row('c', 'update_vehicle', { kind: 'update_vehicle', vehicleId: 'v9', plate: 'ZZZ999', fills: [] });
  const bodiless = row('d', 'navigate', { kind: 'navigate', to: 'holds' });
  const all = [held, registered, other, bodiless];

  it('matches on vehicleId', () => {
    expect(effieWritesForVehicle(all, 'v1', null).map(r => r.id)).toEqual(['a']);
  });

  it('⭐ matches a registration by plate even though it carries no id', () => {
    expect(effieWritesForVehicle(all, 'v1', 'LUR132').map(r => r.id)).toEqual(['b', 'a']);
  });

  it('returns newest first', () => {
    const ids = effieWritesForVehicle(all, 'v1', 'LUR132').map(r => r.id);
    expect(ids[0]).toBe('b');   // 08-05 before 08-02
  });

  it('normalises the plate it is given', () => {
    expect(effieWritesForVehicle(all, null, ' lur 132 ').map(r => r.id)).toEqual(['b', 'a']);
  });

  // ⚠️⚠️ THE FALSE-ATTACHMENT BUG. A `navigate`/`memory`/`reminder` proposal names no car, so its
  // target plate is ''. A car with no plate also normalises to ''. A loose equality would staple
  // every bodiless proposal Effie ever made onto whichever record loaded without a plate — a
  // fabricated provenance trail, which is worse than none at all on a screen built to remove doubt.
  it('⚠️ never attaches a proposal that names no car', () => {
    expect(effieWritesForVehicle(all, null, '')).toEqual([]);
    expect(effieWritesForVehicle(all, null, null)).toEqual([]);
    expect(effieWritesForVehicle(all, '', '   ')).toEqual([]);
    expect(effieWritesForVehicle(all, 'v1', '').map(r => r.id)).toEqual(['a']);   // id still works
  });

  it('never matches a different car', () => {
    expect(effieWritesForVehicle(all, 'v1', 'LUR132').map(r => r.id)).not.toContain('c');
  });

  it('is empty when nothing belongs to the car', () => {
    expect(effieWritesForVehicle(all, 'v-nope', 'AAA111')).toEqual([]);
  });
});

describe('describeEffieWrite', () => {
  it('gives each kind an operator-facing line', () => {
    expect(describeEffieWrite(row('a', 'register_vehicle', {}))).toBe('Registered the car');
    expect(describeEffieWrite(row('a', 'update_vehicle', {}))).toBe('Filled in blank fields');
    expect(describeEffieWrite(row('a', 'register_and_hold', {}))).toBe('Registered the car and flagged a hold');
  });

  // A kind this map has never seen must still read as words, not as a schema token.
  it('falls back to the kind with its underscores opened out', () => {
    expect(describeEffieWrite(row('a', 'some_new_kind', {}))).toBe('some new kind');
  });
});
