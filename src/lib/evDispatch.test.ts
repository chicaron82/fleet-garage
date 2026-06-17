import { describe, it, expect } from 'vitest';
import { evDispatchWarning } from './evDispatch';
import type { Vehicle, Hold } from '../types';

function tesla(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1', unitNumber: '5506', licensePlate: '960NFC',
    make: 'Tesla', model: 'Model 3', year: 2026, color: 'White',
    status: 'CLEAR', branchId: 'YWG',
    isTesla: true, hasMobileCable: true, hasJ1772Adapter: true,
    ...over,
  };
}

function hold(over: Partial<Hold> = {}): Hold {
  return {
    id: 'h1', vehicleId: 'v1',
    holdTypes: ['missing_accessories'], holdType: 'missing_accessories', resolvedTypes: [],
    damageDescription: 'both missing', notes: '',
    flaggedById: 'u1', flaggedByName: 'VSA', flaggedByEmployeeId: 'E1',
    flaggedAt: '2026-06-17T08:00:00.000Z',
    status: 'ACTIVE', branchId: 'YWG',
    ...over,
  };
}

describe('evDispatchWarning', () => {
  it('no warning when a Tesla has both assets present', () => {
    expect(evDispatchWarning(tesla(), [])).toBeNull();
  });

  it('warns on a known-missing cable', () => {
    expect(evDispatchWarning(tesla({ hasMobileCable: false }), [])).toEqual({ missing: ['cable'], notDispatchable: false });
  });

  it('warns on both assets missing', () => {
    expect(evDispatchWarning(tesla({ hasMobileCable: false, hasJ1772Adapter: false }), []))
      .toEqual({ missing: ['cable', 'adapter'], notDispatchable: false });
  });

  it('"not assessed" (null) is NOT a dispatch warning', () => {
    expect(evDispatchWarning(tesla({ hasMobileCable: null, hasJ1772Adapter: null }), [])).toBeNull();
  });

  it('surfaces an open missing-accessories hold as not-dispatchable', () => {
    const out = evDispatchWarning(tesla({ hasMobileCable: false, hasJ1772Adapter: false }), [hold()]);
    expect(out?.notDispatchable).toBe(true);
  });

  it('a resolved missing-accessories hold does not flag not-dispatchable', () => {
    expect(evDispatchWarning(tesla(), [hold({ status: 'RELEASED' })])).toBeNull();
  });

  it('ignores a hold belonging to a different vehicle', () => {
    expect(evDispatchWarning(tesla(), [hold({ vehicleId: 'other' })])).toBeNull();
  });

  it('returns null for a non-Tesla even with missing flags', () => {
    expect(evDispatchWarning(tesla({ make: 'Toyota', isTesla: false, hasMobileCable: false }), [])).toBeNull();
  });

  it('returns null for an undefined vehicle (plate not in fleet)', () => {
    expect(evDispatchWarning(undefined, [])).toBeNull();
  });
});
