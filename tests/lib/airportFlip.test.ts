import { describe, it, expect } from 'vitest';
import { flipRowLine, buildFlipReport, type FlipRow } from '../../src/lib/airportFlip';

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
