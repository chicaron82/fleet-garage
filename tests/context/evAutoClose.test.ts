import { describe, it, expect, vi } from 'vitest';
import { closeNoteFor, makeUpdateEvAssetsAndClose } from '../../src/context/evAutoClose';
import type { Hold } from '../../src/types';

const evHold = (id: string, linkedHoldId: string | null = null): Hold => ({
  id, vehicleId: 'v1', holdTypes: ['missing_accessories'], status: 'RELEASED',
  flaggedAt: '2026-07-20T00:00:00Z', linkedHoldId, release: { releaseType: 'EXCEPTION', actualReturn: null },
} as unknown as Hold);

const setup = (landed = true, holds: Hold[] = [evHold('jul20'), evHold('aug06', 'jul20')]) => {
  const write = vi.fn().mockResolvedValue(landed);
  const markRepaired = vi.fn().mockResolvedValue(undefined);
  const update = makeUpdateEvAssetsAndClose({ write, holds, userId: 'u1', setAllVehicles: vi.fn(), markRepaired });
  return { write, markRepaired, update };
};

describe('makeUpdateEvAssetsAndClose', () => {
  it('both present → the write lands, then the chain head is repaired with who and why', async () => {
    const { write, markRepaired, update } = setup();
    expect(await update('v1', true, true, 'vsa_washbay')).toBe(true);
    expect(write).toHaveBeenCalledWith('v1', true, true, 'vsa_washbay', undefined);
    expect(markRepaired).toHaveBeenCalledTimes(1);
    const [id, repair] = markRepaired.mock.calls[0];
    expect(id).toBe('aug06');
    expect(repair).toMatchObject({ holdId: 'aug06', repairedById: 'u1', outcome: 'clean', notes: closeNoteFor('vsa_washbay') });
  });

  it('one present → the exception stays open', async () => {
    const { markRepaired, update } = setup();
    await update('v1', false, true, 'vsa_washbay');
    expect(markRepaired).not.toHaveBeenCalled();
  });

  it('a write that did not land closes nothing and still reports false', async () => {
    const { markRepaired, update } = setup(false);
    expect(await update('v1', true, true, 'check_in')).toBe(false);
    expect(markRepaired).not.toHaveBeenCalled();
  });

  it('a close that fails does not turn a landed check into a failure', async () => {
    const { markRepaired, update } = setup();
    markRepaired.mockRejectedValueOnce(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await update('v1', true, true, 'vsa_washbay')).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('a car with no EV hold → nothing to close', async () => {
    const { markRepaired, update } = setup(true, []);
    await update('v1', true, true, 'driver_trip');
    expect(markRepaired).not.toHaveBeenCalled();
  });

  it('the note names where the check happened', () => {
    expect(closeNoteFor('check_in')).toBe('Both EV assets present (check-in) — exception closed automatically.');
    expect(closeNoteFor('management')).toContain('management');
  });
});
