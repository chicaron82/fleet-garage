import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hapticLight, hapticMedium, hapticHeavy } from '../../src/lib/haptics';

const original = navigator.vibrate;

beforeEach(() => {
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true, writable: true });
});

afterEach(() => {
  Object.defineProperty(navigator, 'vibrate', { value: original, configurable: true, writable: true });
});

describe('haptics', () => {
  it('light taps vibrate for 10ms', () => {
    hapticLight();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('medium pulses vibrate for 25ms', () => {
    hapticMedium();
    expect(navigator.vibrate).toHaveBeenCalledWith(25);
  });

  it('heavy uses a pattern', () => {
    hapticHeavy();
    expect(navigator.vibrate).toHaveBeenCalledWith([30, 10, 30]);
  });

  it('no-ops (does not throw) when vibrate is unsupported', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
    expect(() => { hapticLight(); hapticMedium(); hapticHeavy(); }).not.toThrow();
  });
});
