import { describe, it, expect } from 'vitest';
import { analogPumped, digitalDelta, digitalWentUp, buildFuelReport, carryForwardOpenings, fuelEntrySummary } from '../../src/lib/fuelReadings';
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
  // Pump 2 is a normal metered pump again (back in service 2026-08-13) — open → close, like Pump 1.
  const row = (over: Partial<FuelRow> = {}): FuelRow => ({
    pump1_open: 417547, pump1_close: 417782,
    pump2_open: 1439, pump2_close: 1520,
    digital_open: 1677, digital_close: 1462.3, topup_note: null, ...over,
  });

  it('is null when there is no fuel row for the day', () => {
    expect(buildFuelReport(null)).toBeNull();
    expect(buildFuelReport(undefined)).toBeNull();
  });

  it('mirrors the paper card: both analog pumps pumped, tank net change', () => {
    const f = buildFuelReport(row())!;
    expect(f.pump1Pumped).toBe(235);          // 417782 − 417547
    expect(f.pump2Open).toBe(1439);
    expect(f.pump2Close).toBe(1520);
    expect(f.pump2Pumped).toBe(81);           // 1520 − 1439
    expect(f.digitalNet).toBeCloseTo(-214.7);  // 1462.3 − 1677, tank drawn down
  });

  it('Pump 2 litres are null until both open and close are present', () => {
    expect(buildFuelReport(row({ pump2_close: null }))!.pump2Pumped).toBeNull();
    expect(buildFuelReport(row({ pump2_open: null }))!.pump2Pumped).toBeNull();
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

describe('carryForwardOpenings — the prefill that was silently never firing', () => {
  const row = (o: Partial<FuelRow>): FuelRow => ({
    pump1_open: null, pump1_close: null,
    pump2_open: null, pump2_close: null,
    digital_open: null, digital_close: null,
    topup_note: null,
    ...o,
  });

  it('prefers a CLOSING when one exists — the truest carry-forward', () => {
    const out = carryForwardOpenings([row({ pump1_open: 100, pump1_close: 150 })]);
    expect(out.pump1Open).toBe(150);
  });

  it('⭐ falls back to that row\'s OPENING when the closing is missing', () => {
    // Aaron's real shape: he works the open, logs the opening, and — as FG's ONLY user —
    // there is no second person to log the close. Before this, the prefill found a row,
    // read a null closing, and silently filled nothing.
    const out = carryForwardOpenings([row({ pump1_open: 437186 })]);
    expect(out.pump1Open).toBe(437186);
  });

  it('reproduces the exact live failure: Aug 14 open-only after Aug 12 had a close', () => {
    const history = [
      row({ pump1_open: 437186 }),                        // Aug 14 — open only (his Friday open)
      row({ pump1_open: 436879 }),                        // Aug 13 — open only
      row({ pump1_open: 436432, pump1_close: 436879 }),   // Aug 12 — the last real closing
    ];
    // Old behaviour took row[0].pump1_close → null → blank field. Now it carries the newest
    // real reading instead of skipping straight past it.
    expect(carryForwardOpenings(history).pump1Open).toBe(437186);
  });

  it('resolves each gauge INDEPENDENTLY, scanning as far back as needed', () => {
    // Pump 2 returned to service later than Pump 1, so its last reading can sit rows away.
    // Locking all three to a single row would blank whichever gauges that row lacks.
    const history = [
      row({ pump1_open: 437186 }),                    // newest: pump 1 only
      row({ digital_close: 6338.8 }),                 // tank, one row back
      row({ pump2_open: 1558 }),                      // pump 2, two rows back
    ];
    expect(carryForwardOpenings(history)).toEqual({
      pump1Open: 437186, pump2Open: 1558, digitalOpen: 6338.8,
    });
  });

  it('returns nulls when there is no history at all', () => {
    expect(carryForwardOpenings([])).toEqual({ pump1Open: null, pump2Open: null, digitalOpen: null });
  });

  it('does not mistake a legitimate ZERO reading for "missing"', () => {
    // A gauge genuinely reading 0 is data. `!= null` (not falsy) is what makes that work.
    expect(carryForwardOpenings([row({ pump1_close: 0 })]).pump1Open).toBe(0);
  });
});

// ⭐⭐ THE ONE-SIDED SHIFT. Aaron, 2026-08-29: *"if i open, i won't be around to enter the closing
// readings. that would be a VERY long shift lol"* — and `useFuelPumpReadings` had already written
// the same fact in its own header: *"FG has one user, so a shift he OPENS has nobody to log its
// close."* Six input boxes, three of which structurally will not be filled by the person looking at
// them, read as unfinished work. The summary's whole job is to phrase what he entered as COMPLETE.
describe('fuelEntrySummary', () => {
  const row = (o: Partial<FuelRow>): FuelRow => ({
    pump1_open: null, pump1_close: null, pump2_open: null, pump2_close: null,
    digital_open: null, digital_close: null, topup_note: null, ...o,
  });

  it('reads a fully-entered gauge as open → close, with the litres pumped', () => {
    const [p1] = fuelEntrySummary(row({ pump1_open: 12345, pump1_close: 12890 }));
    expect(p1).toEqual({ label: 'Pump 1', text: '12,345 → 12,890', delta: '545 L', closed: true });
  });

  // ⚠️ NOT "12,345 → —". A dash is an empty slot, and an empty slot is a request. This is a
  // statement about a shift that is still running.
  it('⭐ phrases an opening-only gauge as a FACT, never as a blank to fill', () => {
    const [p1] = fuelEntrySummary(row({ pump1_open: 12345 }));
    expect(p1).toEqual({ label: 'Pump 1', text: 'opened at 12,345', delta: null, closed: false });
    expect(p1.text).not.toContain('—');
    expect(p1.text).not.toContain('→');
  });

  it('handles a closing-only gauge the same way (he came in on the back half)', () => {
    const [p1] = fuelEntrySummary(row({ pump1_close: 12890 }));
    expect(p1).toEqual({ label: 'Pump 1', text: 'closed at 12,890', delta: null, closed: false });
  });

  // ⚠️ A gauge nobody touched is OMITTED, not shown empty — otherwise the collapsed card
  // reintroduces exactly the three blank boxes it exists to put away.
  it('⚠️ omits a gauge with nothing entered at all', () => {
    const lines = fuelEntrySummary(row({ pump1_open: 1, digital_open: 2.5 }));
    expect(lines.map(l => l.label)).toEqual(['Pump 1', 'Tank']);
  });

  it('keeps the paper card order: Pump 1, Pump 2, Tank', () => {
    const lines = fuelEntrySummary(row({
      pump1_open: 1, pump2_open: 2, digital_open: 3,
    }));
    expect(lines.map(l => l.label)).toEqual(['Pump 1', 'Pump 2', 'Tank']);
  });

  it('carries the tank decimal through the delta', () => {
    const [tank] = fuelEntrySummary(row({ digital_open: 4200.5, digital_close: 4180.2 }));
    expect(tank.delta).toBe('20.3 L');
  });

  // Empty means "stay expanded" to the caller — there is nothing to collapse into.
  it('is empty for a blank row and for no row at all', () => {
    expect(fuelEntrySummary(row({}))).toEqual([]);
    expect(fuelEntrySummary(null)).toEqual([]);
    expect(fuelEntrySummary(undefined)).toEqual([]);
  });
});
