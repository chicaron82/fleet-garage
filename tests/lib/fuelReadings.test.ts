import { describe, it, expect } from 'vitest';
import { analogPumped, digitalDelta, pump2Drifted, digitalWentUp, DEFAULT_PUMP2 } from '../../src/lib/fuelReadings';

describe('analogPumped', () => {
  it('rounds close − open to a whole number', () => {
    expect(analogPumped('1000', '1234')).toBe(234);
    expect(analogPumped('1000', '1234.7')).toBe(235);
  });
  it('is null until both readings are present and numeric', () => {
    expect(analogPumped('', '1234')).toBeNull();
    expect(analogPumped('1000', '')).toBeNull();
    expect(analogPumped('abc', '1234')).toBeNull();
  });
  it('can read negative if someone swaps open/close (surfaces the mistake)', () => {
    expect(analogPumped('1234', '1000')).toBe(-234);
  });
});

describe('digitalDelta', () => {
  it('keeps one decimal of precision', () => {
    expect(digitalDelta('500.0', '512.4')).toBe(12.4);
    expect(digitalDelta('500.00', '512.42')).toBe(12.4); // rounds the 2nd decimal off
  });
  it('is null until both readings are valid', () => {
    expect(digitalDelta('', '512.4')).toBeNull();
    expect(digitalDelta('500', '')).toBeNull();
  });
  it('is negative on normal draw-down', () => {
    expect(digitalDelta('512.4', '500.0')).toBe(-12.4);
  });
});

describe('pump2Drifted — the tripwire', () => {
  it('is false when the entry matches the last recorded value', () => {
    expect(pump2Drifted('1439', DEFAULT_PUMP2)).toBe(false);
  });
  it('fires when the entry differs from the last recorded value', () => {
    expect(pump2Drifted('1201', DEFAULT_PUMP2)).toBe(true); // the side-use incident
    expect(pump2Drifted('1440', DEFAULT_PUMP2)).toBe(true);
  });
  it('reads against whatever the last recorded value is, not a hardcoded baseline', () => {
    expect(pump2Drifted('1201', 1201)).toBe(false);
    expect(pump2Drifted('1439', 1201)).toBe(true);
  });
  it('is not a drift while the field is blank or non-numeric', () => {
    expect(pump2Drifted('', DEFAULT_PUMP2)).toBe(false);
    expect(pump2Drifted('  ', DEFAULT_PUMP2)).toBe(false);
    expect(pump2Drifted('abc', DEFAULT_PUMP2)).toBe(false);
  });
});

describe('digitalWentUp', () => {
  it('is true only when closing exceeds opening (a mid-shift top-up)', () => {
    expect(digitalWentUp('500', '512')).toBe(true);
    expect(digitalWentUp('512', '500')).toBe(false);
    expect(digitalWentUp('500', '500')).toBe(false);
  });
  it('is false until both readings are in', () => {
    expect(digitalWentUp('', '512')).toBe(false);
  });
});
