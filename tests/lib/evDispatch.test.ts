import { describe, it, expect } from 'vitest';
import { evDispatchWarning } from '../../src/lib/evDispatch';
import type { Vehicle, Hold } from '../../src/types';

const tesla = (over: Partial<Vehicle> = {}): Vehicle =>
  ({ id: 'v1', make: 'Tesla', isTesla: true, ...over } as Vehicle);

const missingAccHold = (vehicleId: string): Hold =>
  ({ vehicleId, status: 'ACTIVE', holdTypes: ['missing_accessories'] } as Hold);

describe('evDispatchWarning', () => {
  it('returns null for a missing vehicle', () => {
    expect(evDispatchWarning(undefined, [])).toBeNull();
  });

  it('returns null for a non-Tesla', () => {
    const v = { id: 'v1', make: 'Toyota', isTesla: false } as Vehicle;
    expect(evDispatchWarning(v, [])).toBeNull();
  });

  it('detects a Tesla by make even when isTesla is unset', () => {
    const v = { id: 'v1', make: 'TESLA', hasMobileCable: false } as Vehicle;
    expect(evDispatchWarning(v, [])).toEqual({ missing: ['cable'], notDispatchable: false });
  });

  it('flags known-missing assets (false), not unassessed (null)', () => {
    const v = tesla({ hasMobileCable: false, hasJ1772Adapter: null });
    expect(evDispatchWarning(v, [])).toEqual({ missing: ['cable'], notDispatchable: false });
  });

  it('lists both assets when both are known-missing', () => {
    const v = tesla({ hasMobileCable: false, hasJ1772Adapter: false });
    expect(evDispatchWarning(v, [])?.missing).toEqual(['cable', 'adapter']);
  });

  it('returns null when all present/unassessed and no hold', () => {
    const v = tesla({ hasMobileCable: true, hasJ1772Adapter: null });
    expect(evDispatchWarning(v, [])).toBeNull();
  });

  it('flags notDispatchable on an active missing_accessories hold', () => {
    const v = tesla({ hasMobileCable: true, hasJ1772Adapter: true });
    const result = evDispatchWarning(v, [missingAccHold('v1')]);
    expect(result).toEqual({ missing: [], notDispatchable: true });
  });

  it('ignores a missing_accessories hold on another vehicle', () => {
    const v = tesla({ hasMobileCable: true, hasJ1772Adapter: true });
    expect(evDispatchWarning(v, [missingAccHold('other')])).toBeNull();
  });
});
