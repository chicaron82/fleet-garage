import { describe, it, expect } from 'vitest';
import { analogPumped, digitalDelta, pump2Status, digitalWentUp, buildFuelReport, EXPECTED_PUMP2 } from '../../src/lib/fuelReadings';
import type { FuelRow } from '../../src/lib/fuelReadings';

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

describe('buildFuelReport', () => {
  const row = (over: Partial<FuelRow> = {}): FuelRow => ({
    pump1_open: 417547, pump1_close: 417782, pump2_reading: 1439,
    digital_open: 1677, digital_close: 1462.3, topup_note: null, ...over,
  });

  it('is null when there is no fuel row for the day', () => {
    expect(buildFuelReport(null)).toBeNull();
    expect(buildFuelReport(undefined)).toBeNull();
  });

  it('mirrors the paper card: Pump 1 pumped, locked Pump 2 ok, tank net change', () => {
    const f = buildFuelReport(row())!;
    expect(f.pump1Pumped).toBe(235);       // 417782 − 417547
    expect(f.pump2).toBe('ok');            // locked at 1439, untouched
    expect(f.pump2Reading).toBe(1439);
    expect(f.digitalNet).toBeCloseTo(-214.7); // 1462.3 − 1677, tank drawn down
  });

  it('flags Pump 2 above the lock as used (theft) and below as fault', () => {
    expect(buildFuelReport(row({ pump2_reading: 1500 }))!.pump2).toBe('used');
    expect(buildFuelReport(row({ pump2_reading: 1400 }))!.pump2).toBe('fault');
  });

  it('leaves Pump 2 status null when the reading is absent', () => {
    expect(buildFuelReport(row({ pump2_reading: null }))!.pump2).toBeNull();
  });

  it('carries partial rows — derived figures null until both ends are present', () => {
    const f = buildFuelReport(row({ pump1_close: null, digital_close: null }))!;
    expect(f.pump1Open).toBe(417547);
    expect(f.pump1Pumped).toBeNull();
    expect(f.digitalNet).toBeNull();
  });

  it('passes the top-up note through', () => {
    expect(buildFuelReport(row({ topup_note: 'Tank topped up mid-shift' }))!.topupNote)
      .toBe('Tank topped up mid-shift');
  });
});
