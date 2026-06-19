import { describe, it, expect } from 'vitest';
import { analogPumped, digitalDelta, pump2Status, digitalWentUp, EXPECTED_PUMP2 } from '../../src/lib/fuelReadings';

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

describe('pump2Status — the directional tripwire', () => {
  it("is 'ok' when the locked meter reads its expected value", () => {
    expect(pump2Status('1439', EXPECTED_PUMP2)).toBe('ok');
  });
  it("is 'used' when the reading is ABOVE expected (a cumulative meter only climbs when pumped)", () => {
    expect(pump2Status('1470', EXPECTED_PUMP2)).toBe('used'); // someone used the locked side
    expect(pump2Status('1440', EXPECTED_PUMP2)).toBe('used');
  });
  it("is 'fault' when the reading is BELOW expected (a meter can't decrease)", () => {
    expect(pump2Status('1201', EXPECTED_PUMP2)).toBe('fault'); // impossible drop → fault/misread
    expect(pump2Status('1438', EXPECTED_PUMP2)).toBe('fault');
  });
  it('is null while the field is blank or non-numeric (not an alarm)', () => {
    expect(pump2Status('', EXPECTED_PUMP2)).toBeNull();
    expect(pump2Status('  ', EXPECTED_PUMP2)).toBeNull();
    expect(pump2Status('abc', EXPECTED_PUMP2)).toBeNull();
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
