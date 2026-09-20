import { describe, it, expect, vi } from 'vitest';
import { collectLostWrites, lostWritesNote } from '../../src/lib/lostWrites';

// ⭐⭐ THE AIRPORT FLIP'S SIDE-WRITES (2026-09-19, docs/September/ticket-writes-that-vanish-into-void.md).
// The key count, the odometer and the EV check went out as `void` and the capture card closed on
// the next line. `recordKeyCount` THROWS on a failed write — an unhandled rejection ⚠️ no React
// error boundary catches — and `recordOdometer` returns quietly. So at the return lane on a weak
// signal, the card closed clean and the numbers he had just typed for the counter were gone.

const ok = async () => undefined;
const nope = async () => false;
const boom = async () => { throw new Error('Failed to record key count'); };

describe('collectLostWrites', () => {
  it('writes that all land lose nothing', async () => {
    expect(await collectLostWrites([{ label: 'keys', run: ok }, { label: 'odometer', run: ok }])).toEqual([]);
  });

  // ⚠️ FAILURE SHAPE ONE — the throw that used to vanish into a `void`.
  it('⚠️ names a write that THREW', async () => {
    expect(await collectLostWrites([{ label: 'keys', run: boom }, { label: 'odometer', run: ok }])).toEqual(['keys']);
  });

  // ⚠️ FAILURE SHAPE TWO — the explicit false (`updateVehicleEVAssets`, `recordOnLot`).
  it('⚠️ names a write that returned FALSE', async () => {
    expect(await collectLostWrites([{ label: 'EV check', run: nope }])).toEqual(['EV check']);
  });

  // ⚠️ AND NOT A FALSE ALARM. Most of FG's writers are `Promise<void>`; resolving IS their success.
  it('⚠️ undefined is a success — a void writer must not be reported as lost', async () => {
    expect(await collectLostWrites([{ label: 'odometer', run: async () => { /* void */ } }])).toEqual([]);
  });

  // ⚠️ ONE FAILURE MUST NOT SWALLOW THE REST. The throw used to abort everything after it.
  it('⚠️ a throw does not stop the writes behind it', async () => {
    const after = vi.fn(ok);
    const lost = await collectLostWrites([
      { label: 'keys', run: boom },
      { label: 'odometer', run: after },
      { label: 'EV check', run: nope },
    ]);
    expect(after).toHaveBeenCalledOnce();
    expect(lost).toEqual(['keys', 'EV check']);
  });

  it('keeps the order he would read them in', async () => {
    const lost = await collectLostWrites([
      { label: 'keys', run: nope }, { label: 'odometer', run: nope }, { label: 'EV check', run: nope },
    ]);
    expect(lost).toEqual(['keys', 'odometer', 'EV check']);
  });

  it('nothing to do is not a failure', async () => {
    expect(await collectLostWrites([])).toEqual([]);
  });
});

describe('lostWritesNote', () => {
  it('says nothing when nothing was lost', () => {
    expect(lostWritesNote([])).toBe('');
  });

  // ⭐ It names what is NOT lost: the counter list is built from the row already in hand, and that
  // is the first thing he would wonder standing at the return lane with a car behind him.
  it('⭐ reassures about the counter list in the same breath', () => {
    expect(lostWritesNote(['keys'])).toBe("keys didn't save to FG — the counter list is fine.");
  });

  it('joins several so one sentence covers the capture', () => {
    expect(lostWritesNote(['keys', 'odometer'])).toBe("keys + odometer didn't save to FG — the counter list is fine.");
  });
});
