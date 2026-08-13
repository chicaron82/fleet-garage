// Fuel pump reading maths for the Shift Duties fuel section. Pure so the form,
// the report, and the tests share one source of truth. (Pump 2 returned to
// service 2026-08-13 — it's now a normal analog gauge like Pump 1, no longer the
// locked tripwire; the old EXPECTED_PUMP2 baseline + pump2Status are retired.)

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Litres pumped on an analog gauge = close − open, whole numbers (the gauge
 *  shows no fractions). null until both readings are valid. */
export function analogPumped(open: string, close: string): number | null {
  const o = num(open), c = num(close);
  if (o === null || c === null) return null;
  return Math.round(c - o);
}

/** Digital tank net change = close − open, kept to one decimal (real instrument).
 *  null until both readings are valid. Positive means the tank went UP. */
export function digitalDelta(open: string, close: string): number | null {
  const o = num(open), c = num(close);
  if (o === null || c === null) return null;
  return Math.round((c - o) * 10) / 10;
}

/** A digital reading that went UP mid-shift implies a top-up — prompt for why. */
export function digitalWentUp(open: string, close: string): boolean {
  const d = digitalDelta(open, close);
  return d !== null && d > 0;
}

/** A saved fuel_pump_readings row, the raw numeric shape persisted to the DB.
 *  Pump 2 back in service (2026-08-13) → open/close like Pump 1; the legacy
 *  pump2_reading column remains in the DB for historical rows but is no longer read. */
export interface FuelRow {
  pump1_open:    number | null;
  pump1_close:   number | null;
  pump2_open:    number | null;
  pump2_close:   number | null;
  digital_open:  number | null;
  digital_close: number | null;
  topup_note:    string | null;
}

/** The shift-report fuel block — every reading the paper Gasoline Pump Card
 *  carries, plus the derived pumped / net figures. */
export interface FuelReport {
  pump1Open:    number | null;
  pump1Close:   number | null;
  pump1Pumped:  number | null;       // close − open (litres pumped on Pump 1)
  pump2Open:    number | null;
  pump2Close:   number | null;
  pump2Pumped:  number | null;       // close − open (litres pumped on Pump 2)
  digitalOpen:  number | null;
  digitalClose: number | null;
  digitalNet:   number | null;       // close − open (tank inventory change)
  topupNote:    string | null;
}

/**
 * Shape a saved fuel row into the report block — the readings the paper card
 * shows (Pump 1 + Pump 2 analog meters, digital tank inventory), with the derived
 * figures through the shared pure maths. null when there's no fuel row for the day.
 */
export function buildFuelReport(row: FuelRow | null | undefined): FuelReport | null {
  if (!row) return null;
  const s = (n: number | null) => (n == null ? '' : String(n));
  return {
    pump1Open:    row.pump1_open,
    pump1Close:   row.pump1_close,
    pump1Pumped:  analogPumped(s(row.pump1_open), s(row.pump1_close)),
    pump2Open:    row.pump2_open,
    pump2Close:   row.pump2_close,
    pump2Pumped:  analogPumped(s(row.pump2_open), s(row.pump2_close)),
    digitalOpen:  row.digital_open,
    digitalClose: row.digital_close,
    digitalNet:   digitalDelta(s(row.digital_open), s(row.digital_close)),
    topupNote:    row.topup_note ?? null,
  };
}
