import { describe, it, expect } from 'vitest';
import { shouldAutoStartTimer } from '../../src/lib/autoStartSignal';

// ⚠️ THE DEFECT THIS GUARDS, stated as the CONTRACT rather than as the old mechanism.
//
// The My Day quick-start signals and then NAVIGATES, so the consumer mounts AFTER the signal.
// The old design compared the signal (a counter) against a `useRef` snapshot taken at mount — which
// by then already held the bumped value, so the effect saw no change and the timer never started.
//
// The property that matters is mount-order independence: a signal fired BEFORE the consumer exists
// must still be actionable once it does. A counter-vs-snapshot cannot express that; a pending flag
// the consumer clears can. These assert the gate's half of the contract.
describe('opening-duties auto-start gate', () => {
  it('fires only when the off-standard timer is idle — never clobbers live work', () => {
    expect(shouldAutoStartTimer(1, 'idle')).toBe(true);
    expect(shouldAutoStartTimer(1, 'running')).toBe(false);
    expect(shouldAutoStartTimer(1, 'complete')).toBe(false);
  });

  it('a zero signal never fires — an absent intent is not an intent', () => {
    expect(shouldAutoStartTimer(0, 'idle')).toBe(false);
  });

  // ⭐ The pending-flag design passes a constant 1 for "there is an intent", so the gate reduces to
  // the timer state alone. Pinning that here means a future refactor back to a mount-time snapshot
  // has to confront this file rather than quietly reintroducing the bug.
  it('with an intent present, the gate depends ONLY on timer state', () => {
    for (const state of ['idle', 'running', 'complete', 'saving']) {
      expect(shouldAutoStartTimer(1, state)).toBe(state === 'idle');
    }
  });
});
