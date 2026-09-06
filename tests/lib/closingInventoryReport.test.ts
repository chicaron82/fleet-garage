// The plain-text copy-out for the counter. Aaron: *"how bout a simpler copy to paste into an email?
// much like the airport flips for the counter."* — so the per-line grammar is `flipRowLine`'s, and
// the grouping is his own addition, because that is the shape of the pile he is holding.
//
// ⚠️ The first version shipped with only plate/class/note and he caught it immediately: *"missing
// some fields, the owning 8199 and unit number 5422795."* A block that drops two of the four columns
// the tag fills contradicts the entire reason this feature exists.
import { describe, it, expect } from 'vitest';
import { buildInventoryReport, inventoryReportLine } from '../../src/lib/closingInventoryReport';
import type { InventoryEntry } from '../../src/lib/closingInventory';

const e = (over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id: 'e1', at: 1,
  vehicleId: 'v1', plate: 'LUR306', unitNumber: '5422795', owningArea: '8199',
  rentalClass: 'C', status: 'A', row: '', note: '', ...over,
});

const meta = { location: 'Erin St', dateLabel: 'Sep 3' };

describe('inventoryReportLine', () => {
  // ⭐⭐ ALL FOUR COLUMNS THE TAG FILLS. Plate leads because it is the counter's search key — the
  // same reason flipRowLine leads with it — then the form's own order: owning, unit, class.
  it('carries every column the key tag filled, plate first', () => {
    expect(inventoryReportLine(e({ status: 'A', row: '5' })))
      .toBe('LUR306 · 8199 · 542 2795 · C · R-5');
  });

  // ⚠️ Grouped the way the tag prints it, matching his paper and the photo sheet.
  it('groups the unit number the way the tag does', () => {
    expect(inventoryReportLine(e({ status: 'D', unitNumber: '5426952' })))
      .toBe('LUR306 · 8199 · 542 6952 · C');
  });

  // ⚠️ Same rule as the flip: an empty field is ABSENT, never a dash or a placeholder.
  it('drops a segment that was never filled rather than printing a placeholder', () => {
    expect(inventoryReportLine(e({
      status: 'D', owningArea: null, unitNumber: null, rentalClass: null,
    }))).toBe('LUR306');
  });

  it('carries the hold\'s own words for a body or mechanical car', () => {
    expect(inventoryReportLine(e({
      plate: 'LUR430', unitNumber: '5423001', rentalClass: 'B', status: 'M', note: 'low tire',
    }))).toBe('LUR430 · 8199 · 542 3001 · B · low tire');
  });

  // ⚠️ A row on a non-available car would be a lie — sheetNote already refuses it, and this inherits
  // that refusal rather than re-deciding it.
  it('never prints a row for a car that is not available', () => {
    expect(inventoryReportLine(e({ status: 'D', row: '5' }))).toBe('LUR306 · 8199 · 542 2795 · C');
  });

  // ⭐ An out-of-province car keeps its own owning area — that is the column's whole point.
  it('prints a foreign owning area as it stands', () => {
    expect(inventoryReportLine(e({ plate: '840PIQ', owningArea: '8190', status: 'D' })))
      .toBe('840PIQ · 8190 · 542 2795 · C');
  });
});

describe('buildInventoryReport', () => {
  const sheet = [
    e({ plate: 'LUR306', unitNumber: '5422795', rentalClass: 'C', status: 'A', row: '5' }),
    e({ plate: 'LFJ400', unitNumber: '5426408', rentalClass: 'B5', status: 'A', row: '5' }),
    e({ plate: 'LUR173', unitNumber: '5423102', rentalClass: 'L2', status: 'D' }),
    e({ plate: 'LUR430', unitNumber: '5423001', rentalClass: 'B', status: 'M', note: 'low tire' }),
    e({ plate: 'SSDY46', unitNumber: '5429911', owningArea: '8190', rentalClass: 'T6', status: 'F' }),
  ];

  it('⭐ groups by status, in the order the form legend prints them', () => {
    expect(buildInventoryReport(sheet, meta)).toBe(
      [
        'Erin St closing inventory · Sep 3 · 5 cars',
        '',
        'AVAILABLE (2)',
        'LUR306 · 8199 · 542 2795 · C · R-5',
        'LFJ400 · 8199 · 542 6408 · B5 · R-5',
        '',
        'DIRTY (1)',
        'LUR173 · 8199 · 542 3102 · L2',
        '',
        'MECHANICAL (1)',
        'LUR430 · 8199 · 542 3001 · B · low tire',
        '',
        'FOREIGN (1)',
        'SSDY46 · 8190 · 542 9911 · T6',
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

  // ⭐ The paper never refuses a car, so neither does this — it just has less to say about it.
  it('takes a car FG has never seen, with the columns it does not have left off', () => {
    const out = buildInventoryReport(
      [e({ vehicleId: null, plate: 'LUR999', unitNumber: null, owningArea: null, rentalClass: null, status: 'D' })],
      meta,
    );
    expect(out).toContain('DIRTY (1)\nLUR999');
  });
});
