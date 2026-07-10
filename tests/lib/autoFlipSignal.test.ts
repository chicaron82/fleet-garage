import { describe, it, expect } from 'vitest';
import { shouldStartAutoFlip } from '../../src/lib/autoFlipSignal';

describe('shouldStartAutoFlip', () => {
  it('fires when a real signal lands and the off-standard timer is idle', () => {
    expect(shouldStartAutoFlip(1, 'idle')).toBe(true);
    expect(shouldStartAutoFlip(5, 'idle')).toBe(true);
  });

  it('does NOT fire without a signal (initial 0)', () => {
    expect(shouldStartAutoFlip(0, 'idle')).toBe(false);
  });

  it('never clobbers a running or just-completed off-standard timer', () => {
    expect(shouldStartAutoFlip(1, 'running')).toBe(false);
    expect(shouldStartAutoFlip(1, 'complete')).toBe(false);
  });
});
