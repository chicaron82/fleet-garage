// How the closing sheet is PRESENTED and handed onward — the piles both the on-screen table and the
// copied report draw from, and the two counts the washbay log seeds. Split out of
// `closingInventory.test` when the module split at the 330-line cap (2026-09-06), so FG's
// lib-coverage canary sees the tests against the module they actually cover.
import { describe, it, expect } from 'vitest';
import { groupEntries, GROUP_ORDER, seedClosingCounts } from '../../src/lib/closingInventoryViews';
import type { InventoryEntry } from '../../src/lib/closingInventory';


describe('groupEntries — one grouping rule for the table and the copied report', () => {
  // ⭐ Aaron, 2026-09-05, first real 24-car sweep: *"I thought it was going to sort both my scans
  // AND the version I copy to the email."* His sheet ran M, B, M — the piles only formed on copy.
  const row = (plate: string, status: InventoryEntry['status']): InventoryEntry => ({
    id: plate, at: 1, vehicleId: null, plate, unitNumber: null, owningArea: null, rentalClass: null,
    status, row: '', note: '',
  });
  // Deliberately interleaved, the way a lot actually hands him cars.
  const sheet = [row('M1', 'M'), row('B1', 'B'), row('M2', 'M'), row('A1', 'A'), row('B2', 'B')];

  it('orders the piles the way the form legend does — A D B M F', () => {
    expect(groupEntries(sheet).map(g => g.status)).toEqual(['A', 'B', 'M']);
    expect(GROUP_ORDER).toEqual(['A', 'D', 'B', 'M', 'F']);
  });

  it('omits a status nobody wrote up rather than printing it empty', () => {
    // An empty "BODY (0)" would claim the lot was checked for body damage and found clean.
    expect(groupEntries(sheet).map(g => g.status)).not.toContain('D');
    expect(groupEntries([])).toEqual([]);
  });

  it('⚠️ carries each row\'s ORIGINAL sheet index, never its drawn position', () => {
    // The safety property: onEdit/onRemove address the sheet by position, so a display index would
    // act on a different car than the one under his thumb.
    const flat = groupEntries(sheet).flatMap(g => g.rows);
    for (const { entry, index } of flat) expect(sheet[index]).toBe(entry);
    // M1 is the witness that actually diverges: scanned FIRST, drawn FOURTH once the piles form.
    // Tapping its × must remove sheet row 0, not row 3.
    expect(flat.find(r => r.entry.plate === 'M1')?.index).toBe(0);
    expect(flat.findIndex(r => r.entry.plate === 'M1')).toBe(3);
  });

  it('keeps scan order inside a pile — the sort is by status only', () => {
    const m = groupEntries(sheet).find(g => g.status === 'M');
    expect(m?.rows.map(r => r.entry.plate)).toEqual(['M1', 'M2']);
  });

  it('loses nothing and duplicates nothing', () => {
    const flat = groupEntries(sheet).flatMap(g => g.rows);
    expect(flat).toHaveLength(sheet.length);
    expect(new Set(flat.map(r => r.index)).size).toBe(sheet.length);
  });
});

describe('seedClosingCounts — the sheet feeds the washbay log', () => {
  // ⚠️ THE MAPPING IS THE WHOLE POINT AND IT IS EASY TO INVERT. Aaron had to spell it out:
  // *"rentable on the lot that have been cleaned but not sent to the airport / dirties are returns
  // from the airport that are now at Erin St. this is what the morning crew will be cleaning."*
  // "Clean, not picked up" means NOT YET SENT UP, not "a customer didn't collect it".
  const r = (status: InventoryEntry['status']): InventoryEntry => ({
    id: crypto.randomUUID(), at: 1, vehicleId: null, plate: 'X', unitNumber: null, owningArea: null, rentalClass: null,
    status, row: '', note: '',
  });

  it('A becomes the cleans and D becomes the queue — never the other way round', () => {
    // Deliberately different counts, so a swap cannot pass.
    const sheet = [r('A'), r('A'), r('A'), r('D')];
    expect(seedClosingCounts(sheet)).toEqual({ queueAtClose: '1', cleanNotSent: '3' });
  });

  it('leaves B and M out of both — a held car is not washbay work', () => {
    const sheet = [r('A'), r('D'), r('B'), r('B'), r('M'), r('M'), r('M'), r('F')];
    expect(seedClosingCounts(sheet)).toEqual({ queueAtClose: '1', cleanNotSent: '1' });
  });

  it("⚠️ seeds NOTHING for an empty sheet, not zero", () => {
    // "I didn't write up a lot" is not the claim "the lot was empty" — and tomorrow's opening card
    // reads both numbers back, so a seeded 0 would be inherited as fact.
    expect(seedClosingCounts([])).toEqual({ queueAtClose: '', cleanNotSent: '' });
  });

  it('does seed a real zero when the sheet genuinely holds none of that status', () => {
    // A written-up lot with nothing dirty IS the claim "no queue at close" — that one is earned.
    expect(seedClosingCounts([r('A'), r('A')])).toEqual({ queueAtClose: '0', cleanNotSent: '2' });
  });

  it("reproduces Aaron's 2026-09-05 sweep — 24 cars, 15 clean, 2 dirty", () => {
    const sheet = [
      ...Array.from({ length: 15 }, () => r('A')),
      ...Array.from({ length: 2 },  () => r('D')),
      ...Array.from({ length: 2 },  () => r('B')),
      ...Array.from({ length: 5 },  () => r('M')),
    ];
    expect(sheet).toHaveLength(24);
    expect(seedClosingCounts(sheet)).toEqual({ queueAtClose: '2', cleanNotSent: '15' });
  });
});
