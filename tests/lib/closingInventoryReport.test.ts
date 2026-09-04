// The plain-text copy-out for the counter. Aaron: *"how bout a simpler copy to paste into an email?
// much like the airport flips for the counter."* — so the per-line grammar is `flipRowLine`'s, and
// the grouping is his own addition, because that is the shape of the pile he is holding.
import { describe, it, expect } from 'vitest';
import { buildInventoryReport, inventoryReportLine } from '../../src/lib/closingInventoryReport';
import type { InventoryEntry } from '../../src/lib/closingInventory';

const e = (over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  vehicleId: 'v1', plate: 'LUR306', unitNumber: '5426952', owningArea: '8199',
  rentalClass: 'C', status: 'A', row: '', note: '', ...over,
});

const meta = { location: 'Erin St', dateLabel: 'Sep 3' };

describe('inventoryReportLine', () => {
  // ⭐ Plate first — it is the counter's search key, which is why the flip line leads with it too.
  it('leads with the plate, then the class, then the note', () => {
    expect(inventoryReportLine(e({ status: 'A', row: '5' }))).toBe('LUR306 · C · R-5');
  });

  // ⚠️ Same rule as the flip: an empty field is ABSENT, never a dash or a placeholder.
  it('drops a segment that was never filled rather than printing a placeholder', () => {
    expect(inventoryReportLine(e({ status: 'D', rentalClass: null }))).toBe('LUR306');
    expect(inventoryReportLine(e({ status: 'D' }))).toBe('LUR306 · C');
  });

  it('carries the hold\'s own words for a body or mechanical car', () => {
    expect(inventoryReportLine(e({ plate: 'LUR430', rentalClass: 'B', status: 'M', note: 'low tire' })))
      .toBe('LUR430 · B · low tire');
  });

  // ⚠️ A row on a non-available car would be a lie — sheetNote already refuses it, and this inherits
  // that refusal rather than re-deciding it.
  it('never prints a row for a car that is not available', () => {
    expect(inventoryReportLine(e({ status: 'D', row: '5' }))).toBe('LUR306 · C');
  });
});

describe('buildInventoryReport', () => {
  const sheet = [
    e({ plate: 'LUR306', rentalClass: 'C', status: 'A', row: '5' }),
    e({ plate: 'LFJ400', rentalClass: 'B5', status: 'A', row: '5' }),
    e({ plate: 'MCM560', rentalClass: 'C', status: 'A', row: '4' }),
    e({ plate: 'LUR173', rentalClass: 'L2', status: 'D' }),
    e({ plate: 'LUR430', rentalClass: 'B', status: 'M', note: 'low tire' }),
    e({ plate: 'SSDY46', rentalClass: 'T6', status: 'F' }),
  ];

  it('⭐ groups by status, in the order the form legend prints them', () => {
    expect(buildInventoryReport(sheet, meta)).toBe(
      [
        'Erin St closing inventory · Sep 3 · 6 cars',
        '',
        'AVAILABLE (3)',
        'LUR306 · C · R-5',
        'LFJ400 · B5 · R-5',
        'MCM560 · C · R-4',
        '',
        'DIRTY (1)',
        'LUR173 · L2',
        '',
        'MECHANICAL (1)',
        'LUR430 · B · low tire',
        '',
        'FOREIGN (1)',
        'SSDY46 · T6',
      ].join('\n'),
    );
  });

  // ⚠️ An empty "BODY (0)" heading would read as a claim that the lot was checked for body damage
  // and found clean. This sheet cannot support that, so a status nobody wrote up prints nothing.
  it('omits a status nobody wrote up — never an empty heading', () => {
    const out = buildInventoryReport([e({ status: 'A', row: '5' })], meta);
    expect(out).toContain('AVAILABLE (1)');
    expect(out).not.toContain('BODY');
    expect(out).not.toContain('DIRTY');
  });

  // ⚠️ Empty like buildFlipReport, so the caller can skip the clipboard write entirely.
  it('is empty when nothing has been written up', () => {
    expect(buildInventoryReport([], meta)).toBe('');
  });

  it('counts one car in the singular', () => {
    expect(buildInventoryReport([e({ status: 'D' })], meta))
      .toContain('Erin St closing inventory · Sep 3 · 1 car');
  });

  it('takes a car FG has never seen, with the columns it does not have left off', () => {
    const out = buildInventoryReport(
      [e({ vehicleId: null, plate: 'LUR999', unitNumber: null, rentalClass: null, status: 'D' })],
      meta,
    );
    expect(out).toContain('DIRTY (1)\nLUR999');
  });
});
