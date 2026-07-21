import { describe, it, expect } from 'vitest';
import { flipRowLine, buildFlipReport, normalizeFlipRow, flipClassSummary, type FlipRow } from '../../src/lib/airportFlip';

const row = (over: Partial<FlipRow>): FlipRow => ({
  id: 'r1', plate: 'LFJ285', unit: '5427802', odo: '41230', fuel: '7/8',
  isEv: false, damaged: false, rentalClass: '', notes: '', checked: true, sent: false, ...over,
});

describe('flipRowLine', () => {
  it('plate leads (the counter searches by plate), then the filled fields', () => {
    expect(flipRowLine(row({}))).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });

  it('a damaged return carries the flag — the field the counter most needs before closing', () => {
    expect(flipRowLine(row({ damaged: true }))).toBe('LFJ285 · odo 41230 · fuel 7/8 · ⚠️ damage');
  });

  it('omits fields left blank rather than printing empty labels', () => {
    expect(flipRowLine(row({ odo: '', fuel: '' }))).toBe('LFJ285');
    expect(flipRowLine(row({ fuel: '' }))).toBe('LFJ285 · odo 41230');
  });

  it('never includes the unit# — the copy-out is minimal by design (plate only)', () => {
    expect(flipRowLine(row({ unit: '5427802' }))).not.toContain('5427802');
  });

  it('trims whitespace out of the readings', () => {
    expect(flipRowLine(row({ odo: '  41230 ', fuel: ' F ' }))).toBe('LFJ285 · odo 41230 · fuel F');
  });

  it('a note rides the line only when filled (last, after the damage flag)', () => {
    expect(flipRowLine(row({ notes: 'weed smell' }))).toBe('LFJ285 · odo 41230 · fuel 7/8 · weed smell');
    expect(flipRowLine(row({ damaged: true, notes: 'weed smell' }))).toBe('LFJ285 · odo 41230 · fuel 7/8 · ⚠️ damage · weed smell');
    expect(flipRowLine(row({ notes: '   ' }))).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });
});

describe('buildFlipReport', () => {
  it('one line per row, newline-joined', () => {
    const text = buildFlipReport([
      row({ id: 'a', plate: 'LFJ285' }),
      row({ id: 'b', plate: 'LUR170', odo: '12005', fuel: 'F', damaged: true }),
    ]);
    expect(text).toBe('LFJ285 · odo 41230 · fuel 7/8\nLUR170 · odo 12005 · fuel F · ⚠️ damage');
  });

  it('empty set → empty string (caller skips the clipboard write)', () => {
    expect(buildFlipReport([])).toBe('');
  });
});

describe('flipRowLine — resilience to rows saved before a field existed', () => {
  it('does NOT throw on a row missing notes (persisted before the notes field shipped)', () => {
    // A row hydrated from sessionStorage written by an older build has no `notes` key.
    // The list re-renders it, so flipRowLine must survive the undefined (the 2026-07-17 crash).
    const old = { id: 'r', plate: 'LFJ285', unit: null, odo: '41230', fuel: '7/8', damaged: false, checked: true, sent: false } as unknown as FlipRow;
    expect(() => flipRowLine(old)).not.toThrow();
    expect(flipRowLine(old)).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });
});

describe('normalizeFlipRow', () => {
  it('fills every missing field so an old persisted row can never crash a render', () => {
    const healed = normalizeFlipRow({ id: 'r', plate: 'LFJ285', odo: '41230', fuel: '7/8' });
    expect(healed).toEqual({ id: 'r', plate: 'LFJ285', unit: null, odo: '41230', fuel: '7/8', isEv: false, damaged: false, rentalClass: '', notes: '', checked: true, sent: false });
  });
  it('preserves what is already there (a sent+unchecked row stays that way)', () => {
    const row: FlipRow = { id: 'r', plate: 'LUR170', unit: '5427802', odo: '1', fuel: 'F', isEv: false, damaged: true, rentalClass: 'Q4', notes: 'weed smell', checked: false, sent: true };
    expect(normalizeFlipRow(row)).toEqual(row);
  });
});

// ── flipClassSummary: Aaron's own "what I turned around, by class" shift tally ──────────
describe('flipClassSummary', () => {
  it('counts flips by class, most-flipped first', () => {
    const rows = [
      row({ id: '1', rentalClass: 'Q4' }),
      row({ id: '2', rentalClass: 'P4' }),
      row({ id: '3', rentalClass: 'Q4' }),
      row({ id: '4', rentalClass: 'Q4' }),
      row({ id: '5', rentalClass: 'V' }),
    ];
    expect(flipClassSummary(rows)).toEqual({
      byClass: [
        { rentalClass: 'Q4', count: 3 },
        { rentalClass: 'P4', count: 1 },
        { rentalClass: 'V', count: 1 },
      ],
      unclassed: 0,
    });
  });

  it('normalizes case and whitespace so "q4" and "Q4 " count together', () => {
    const rows = [row({ id: '1', rentalClass: 'q4' }), row({ id: '2', rentalClass: 'Q4 ' })];
    expect(flipClassSummary(rows)).toEqual({ byClass: [{ rentalClass: 'Q4', count: 2 }], unclassed: 0 });
  });

  it('counts rows with no legible class as unclassed — never implies all were classed', () => {
    const rows = [row({ id: '1', rentalClass: 'Q4' }), row({ id: '2', rentalClass: '' }), row({ id: '3', rentalClass: '  ' })];
    expect(flipClassSummary(rows)).toEqual({ byClass: [{ rentalClass: 'Q4', count: 1 }], unclassed: 2 });
  });

  it('ties break alphabetically by class', () => {
    const rows = [row({ id: '1', rentalClass: 'V' }), row({ id: '2', rentalClass: 'P4' })];
    expect(flipClassSummary(rows).byClass).toEqual([{ rentalClass: 'P4', count: 1 }, { rentalClass: 'V', count: 1 }]);
  });

  it('empty list → empty tally', () => {
    expect(flipClassSummary([])).toEqual({ byClass: [], unclassed: 0 });
  });
});

describe('normalizeFlipRow heals the added rentalClass field', () => {
  it('an older stored row with no rentalClass defaults to blank, never crashes', () => {
    const old = { id: 'x', plate: 'ABC123', odo: '100', fuel: 'F', damaged: false, checked: true, sent: false };
    expect(normalizeFlipRow(old).rentalClass).toBe('');
  });
});

// An EV return captures a battery PERCENTAGE, not a fuel fraction — the counter line has to say so.
describe('flipRowLine — EV returns read "charge", gas reads "fuel"', () => {
  it('an EV row labels the level as charge', () => {
    expect(flipRowLine(row({ isEv: true, fuel: '67%' }))).toBe('LFJ285 · odo 41230 · charge 67%');
  });

  it('a gas row still labels it fuel', () => {
    expect(flipRowLine(row({ isEv: false, fuel: '7/8' }))).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });

  it('an older persisted row with no isEv defaults to fuel, never crashes', () => {
    const old = { id: 'x', plate: 'ABC123', odo: '100', fuel: 'F', damaged: false, checked: true, sent: false };
    expect(normalizeFlipRow(old).isEv).toBe(false);
    expect(flipRowLine(normalizeFlipRow(old))).toBe('ABC123 · odo 100 · fuel F');
  });
});
