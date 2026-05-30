import { describe, it, expect } from 'vitest';
import { generateInventoryExport, inventoryExportFilename } from '../../src/lib/inventory-export';

type Entry = Parameters<typeof generateInventoryExport>[0][number];

function entry(over: Partial<Entry> = {}): Entry {
  return {
    unitNumber: '5426408',
    licensePlate: 'ABC123',
    classification: 'Rentable',
    zone: null,
    row: null,
    locationText: '',
    ...over,
  };
}

const meta = { date: '2026-05-22', location: 'YWG', loggedByName: 'Ana' };

// ── status letter mapping (A / D / B / M) ─────────────────────────────────────

describe('generateInventoryExport — status letters', () => {
  it('Rentable → A', () => {
    expect(generateInventoryExport([entry({ classification: 'Rentable' })], meta)).toContain('status a">A<');
  });

  it('Dirty → D', () => {
    expect(generateInventoryExport([entry({ classification: 'Dirty' })], meta)).toContain('status d">D<');
  });

  it('Held + damage → B', () => {
    expect(generateInventoryExport([entry({ classification: 'Held', holdType: 'damage' })], meta)).toContain('status b">B<');
  });

  it('Held + non-damage → M', () => {
    expect(generateInventoryExport([entry({ classification: 'Held', holdType: 'mechanical' })], meta)).toContain('status m">M<');
  });
});

// ── unit formatting + escaping ────────────────────────────────────────────────

describe('generateInventoryExport — formatting', () => {
  it('formats a 7-digit unit as "NNN NNNN"', () => {
    expect(generateInventoryExport([entry({ unitNumber: '5426408' })], meta)).toContain('542 6408');
  });

  it('leaves non-7-digit units unchanged', () => {
    expect(generateInventoryExport([entry({ unitNumber: 'TEMP12' })], meta)).toContain('TEMP12');
  });

  it('HTML-escapes plate values', () => {
    const html = generateInventoryExport([entry({ licensePlate: 'A&B<C' })], meta);
    expect(html).toContain('A&amp;B&lt;C');
    expect(html).not.toContain('A&B<C');
  });

  it('includes the meta header (location, date, logger)', () => {
    const html = generateInventoryExport([], meta);
    expect(html).toContain('YWG');
    expect(html).toContain('2026-05-22');
    expect(html).toContain('Ana');
  });
});

// ── filename ──────────────────────────────────────────────────────────────────

describe('inventoryExportFilename', () => {
  it('is a date/time-stamped .html name', () => {
    expect(inventoryExportFilename()).toMatch(/^fleet-inventory-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.html$/);
  });
});
