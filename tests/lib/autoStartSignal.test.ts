import { describe, it, expect } from 'vitest';
import { shouldAutoStartTimer } from '../../src/lib/autoStartSignal';

describe('shouldAutoStartTimer', () => {
  it('fires when a real signal lands and the off-standard timer is idle', () => {
    expect(shouldAutoStartTimer(1, 'idle')).toBe(true);
    expect(shouldAutoStartTimer(5, 'idle')).toBe(true);
  });

  it('does NOT fire without a signal (initial 0)', () => {
    expect(shouldAutoStartTimer(0, 'idle')).toBe(false);
  });

  it('never clobbers a running or just-completed off-standard timer', () => {
    expect(shouldAutoStartTimer(1, 'running')).toBe(false);
    expect(shouldAutoStartTimer(1, 'complete')).toBe(false);
  });
});
