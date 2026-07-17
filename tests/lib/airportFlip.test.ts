import { describe, it, expect } from 'vitest';
import { flipRowLine, buildFlipReport, normalizeFlipRow, type FlipRow } from '../../src/lib/airportFlip';

const row = (over: Partial<FlipRow>): FlipRow => ({
  id: 'r1', plate: 'LFJ285', unit: '5427802', odo: '41230', fuel: '7/8',
  damaged: false, notes: '', checked: true, sent: false, ...over,
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
    expect(healed).toEqual({ id: 'r', plate: 'LFJ285', unit: null, odo: '41230', fuel: '7/8', damaged: false, notes: '', checked: true, sent: false });
  });
  it('preserves what is already there (a sent+unchecked row stays that way)', () => {
    const row: FlipRow = { id: 'r', plate: 'LUR170', unit: '5427802', odo: '1', fuel: 'F', damaged: true, notes: 'weed smell', checked: false, sent: true };
    expect(normalizeFlipRow(row)).toEqual(row);
  });
});
