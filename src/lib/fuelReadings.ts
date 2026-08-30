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

/** What a new day's form should open with, carried forward from history. */
export interface CarriedOpenings {
  pump1Open:   number | null;
  pump2Open:   number | null;
  digitalOpen: number | null;
}

/**
 * The opening readings a fresh day should pre-fill with — the LAST KNOWN READING per gauge,
 * scanning history newest-first.
 *
 * ⚠️ WHY THIS EXISTS (Aaron, 2026-08-16, and his diagnosis was the sharper one): the original
 * prefill read the previous ROW's *closing* values, which quietly almost never fired. His data
 * explains it — Aug 12 recorded a close (436879) and Aug 13's open carried it perfectly, then
 * Aug 13 and Aug 14 went in **open-only** and the chain died.
 *
 * **The root cause is structural, not forgetfulness: FG has ONE user.** The closing-to-opening
 * relay assumes a two-person handoff — opener logs open, closer logs close, next opener inherits.
 * When Aaron works an open, *nobody exists to log the close*, so that half of the sheet has no
 * author. Another artifact of the abandoned multi-operator shape (see CLAUDE.md "Personal-first").
 *
 * So: prefer a row's CLOSING (still the truest carry-forward when it's there), fall back to that
 * same row's OPENING, and keep scanning back until each gauge finds a number. An opening is a
 * real reading the pump gave him — the number will have moved since, but it's the right ballpark,
 * and a transposed digit becomes obvious instead of invisible. A blank field teaches nothing.
 *
 * Each gauge resolves INDEPENDENTLY: pump 2 came back into service later than pump 1, so its
 * last reading can be many rows newer or older than the others'. Locking all three to one row
 * would blank the gauges that happen to be missing from it.
 */
export function carryForwardOpenings(rowsNewestFirst: readonly FuelRow[]): CarriedOpenings {
  const firstOf = (close: (r: FuelRow) => number | null, open: (r: FuelRow) => number | null) => {
    for (const r of rowsNewestFirst) {
      const c = close(r);
      if (c != null) return c;
      const o = open(r);
      if (o != null) return o;
    }
    return null;
  };
  return {
    pump1Open:   firstOf(r => r.pump1_close,   r => r.pump1_open),
    pump2Open:   firstOf(r => r.pump2_close,   r => r.pump2_open),
    digitalOpen: firstOf(r => r.digital_close, r => r.digital_open),
  };
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

/** One gauge, as it should READ once the operator has entered what he can. */
export interface GaugeLine {
  label: string;
  /** Fully entered → "12,345 → 12,890"; opening only → "opened at 12,345". */
  text: string;
  /** Litres pumped / net change, when both ends exist. */
  delta: string | null;
  /** True when a closing reading exists. Never rendered as a GAP when false. */
  closed: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-CA');

function gauge(label: string, open: number | null, close: number | null, unit: string): GaugeLine | null {
  if (open == null && close == null) return null;
  if (open != null && close != null) {
    const d = Math.round((close - open) * 10) / 10;
    return { label, text: `${fmt(open)} → ${fmt(close)}`, delta: `${fmt(Math.abs(d))} ${unit}`, closed: true };
  }
  // ⚠️ ONE-SIDED IS A COMPLETE ANSWER, NOT A HALF-FILLED FORM. `useFuelPumpReadings` already says
  // it in its own header — *"FG has one user, so a shift he OPENS has nobody to log its close."*
  // Aaron, 2026-08-29: *"if i open, i won't be around to enter the closing readings. that would be
  // a VERY long shift lol"*. So a missing closing is phrased as a fact about the shift, never as an
  // empty slot with a dash in it: a blank waiting to be filled reads as work owed, and it isn't his.
  return open != null
    ? { label, text: `opened at ${fmt(open)}`, delta: null, closed: false }
    : { label, text: `closed at ${fmt(close!)}`, delta: null, closed: false };
}

/**
 * The collapsed read-back of a saved fuel entry — what he actually put in, in the order the paper
 * card runs. Empty array when nothing has been entered at all, so the caller can stay expanded.
 */
export function fuelEntrySummary(row: FuelRow | null | undefined): GaugeLine[] {
  if (!row) return [];
  return [
    gauge('Pump 1', row.pump1_open, row.pump1_close, 'L'),
    gauge('Pump 2', row.pump2_open, row.pump2_close, 'L'),
    gauge('Tank', row.digital_open, row.digital_close, 'L'),
  ].filter((g): g is GaugeLine => g !== null);
}
