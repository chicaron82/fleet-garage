import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRegisterFollowUps } from '../../src/context/registerFollowUps';
import type { RegisterFollowUpInput, RegisterFollowUpOps } from '../../src/context/registerFollowUps';

const teachClassCode = vi.hoisted(() => vi.fn());
vi.mock('../../src/hooks/useUnknownClassCode', () => ({ teachClassCode }));

// The five best-effort writes that run AFTER a registration has succeeded. They were untested for
// as long as they lived inside a 107-line submit handler; extracting them (2026-08-25, when the
// form crossed the line cap) is what made them reachable.
//
// The rule they all share: NONE may fail the registration. The car already exists by the time any
// of this runs, so an error that bubbled up would re-enable the submit button and invite a second
// tap — minting a DUPLICATE CAR.

const ops = (over: Partial<RegisterFollowUpOps> = {}): RegisterFollowUpOps => ({
  attachKeytagPhotoIfMissing: vi.fn().mockResolvedValue(undefined),
  updateVehicleEVAssets: vi.fn().mockResolvedValue(true),
  releaseUnitNumber: vi.fn().mockResolvedValue(undefined),
  remember: vi.fn(),
  ...over,
});

const input = (over: Partial<RegisterFollowUpInput> = {}): RegisterFollowUpInput => ({
  vehicleId: 'veh-1', unit: '5420211', plate: 'LJF683',
  make: 'Tesla', model: 'Model 3', isTesla: true,
  cable: 'present', adapter: 'present', ...over,
});

beforeEach(() => teachClassCode.mockClear());

describe('runRegisterFollowUps', () => {
  it('reports both clear when everything lands', async () => {
    expect(await runRegisterFollowUps(input(), ops())).toEqual({ evLogFailed: false, releaseFailed: false });
  });

  describe('the EV asset log', () => {
    it('logs the pair through the asset-history path, sourced to the washbay', async () => {
      const o = ops();
      await runRegisterFollowUps(input({ cable: 'present', adapter: 'missing' }), o);
      expect(o.updateVehicleEVAssets).toHaveBeenCalledWith('veh-1', true, false, 'vsa_washbay');
    });

    it('writes NOTHING when he withdrew the check — not assessed is not "both missing"', async () => {
      const o = ops();
      await runRegisterFollowUps(input({ cable: null, adapter: null }), o);
      expect(o.updateVehicleEVAssets).not.toHaveBeenCalled();
    });

    it('skips a non-Tesla entirely', async () => {
      const o = ops();
      await runRegisterFollowUps(input({ isTesla: false, make: 'Kia', model: 'Seltos' }), o);
      expect(o.updateVehicleEVAssets).not.toHaveBeenCalled();
    });

    // ⚠️ The R61 defect, rebuilt by hand in this file's previous home: updateVehicleEVAssets does
    // not THROW, it swallows the Supabase error and returns false. A try/catch would be dead code
    // reporting a lost assessment as a clean registration.
    it('reports a failure signalled by the RETURN VALUE, not by an exception', async () => {
      const o = ops({ updateVehicleEVAssets: vi.fn().mockResolvedValue(false) });
      const r = await runRegisterFollowUps(input(), o);
      expect(r.evLogFailed).toBe(true);
    });
  });

  describe('the unit-number release', () => {
    it('only fires when a conflict was actually confirmed', async () => {
      const o = ops();
      await runRegisterFollowUps(input(), o);
      expect(o.releaseUnitNumber).not.toHaveBeenCalled();
    });

    it('releases the record that wrongly held the number', async () => {
      const o = ops();
      await runRegisterFollowUps(input({ conflictVehicleId: 'old-veh' }), o);
      expect(o.releaseUnitNumber).toHaveBeenCalledWith('old-veh');
    });

    it('REPORTS a throw rather than propagating it — a recoverable duplicate he must be told about', async () => {
      const o = ops({ releaseUnitNumber: vi.fn().mockRejectedValue(new Error('boom')) });
      const r = await runRegisterFollowUps(input({ conflictVehicleId: 'old-veh' }), o);
      expect(r.releaseFailed).toBe(true);
      expect(r.evLogFailed).toBe(false);   // one failure must not contaminate the other
    });
  });

  describe('the codex teach', () => {
    it('teaches only the code he CONFIRMED, when the scan could not resolve one', async () => {
      await runRegisterFollowUps(input({ teachCode: 'CTMY', userId: 'u-1' }), ops());
      expect(teachClassCode).toHaveBeenCalledWith('CTMY', 'Tesla', 'Model 3', 'u-1');
    });

    it('teaches NOTHING without a code — no entry beats a wrong one', async () => {
      await runRegisterFollowUps(input(), ops());
      expect(teachClassCode).not.toHaveBeenCalled();
    });
  });

  it('attaches the source key tag only when the scan carried one', async () => {
    const withPhoto = ops();
    await runRegisterFollowUps(input({ keytagPhoto: 'data:image/jpeg;base64,AAA' }), withPhoto);
    expect(withPhoto.attachKeytagPhotoIfMissing).toHaveBeenCalledWith('veh-1', 'data:image/jpeg;base64,AAA');

    const without = ops();
    await runRegisterFollowUps(input(), without);
    expect(without.attachKeytagPhotoIfMissing).not.toHaveBeenCalled();
  });

  it('points the plate registry at the now-canonical vehicle', async () => {
    const o = ops();
    await runRegisterFollowUps(input(), o);
    expect(o.remember).toHaveBeenCalledWith('LJF683', { vehicleId: 'veh-1', unitNumber: '5420211' });
  });

  // ⭐ THE LOAD-BEARING ONE. The car is already registered by the time any of this runs, so a
  // throw escaping here would reach handleSubmit's catch, reset `submitting`, and invite the second
  // tap that mints a DUPLICATE CAR. Every write is individually best-effort; the function as a
  // whole must not reject no matter what its collaborators do.
  it('never rejects, even when every single write blows up', async () => {
    const o = ops({
      attachKeytagPhotoIfMissing: vi.fn().mockRejectedValue(new Error('x')),
      updateVehicleEVAssets: vi.fn().mockRejectedValue(new Error('x')),
      releaseUnitNumber: vi.fn().mockRejectedValue(new Error('x')),
      remember: vi.fn(() => { throw new Error('x'); }),
    });
    teachClassCode.mockImplementationOnce(() => { throw new Error('x'); });

    const r = await runRegisterFollowUps(
      input({ conflictVehicleId: 'old', keytagPhoto: 'p', teachCode: 'CTMY' }), o,
    );
    // Both failures reported, neither thrown — he learns what didn't land and keeps his car.
    expect(r).toEqual({ evLogFailed: true, releaseFailed: true });
  });
});
