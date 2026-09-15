import { describe, it, expect } from 'vitest';
import { planArchive, toArchiveRow } from '../../src/lib/closingInventoryArchive';
import type { InventoryEntry } from '../../src/lib/closingInventory';

// The closing inventory, kept (migration 146). Aaron, 2026-09-14: *"data is still data why not add
// it in when its available. i know there will be gaps."*
//
// The rules that matter here are all about NOT LOSING a close: the incremental write must never skip
// a row, a tombstone must reach the archive, and the ring grouping the paper encodes must survive.

const DAY = '2026-09-13';
const USER = 'u1';

const entry = (over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id: 'e1', at: 100, vehicleId: 'v1', plate: 'LUR324', unitNumber: '5422241',
  owningArea: '8199', rentalClass: 'B5', status: 'A', row: '5', note: '', ...over,
});

describe('toArchiveRow', () => {
  it('carries all four columns the tag filled, plus the status and the row', () => {
    expect(toArchiveRow(entry(), DAY, USER, 0)).toEqual({
      id: 'e1', day: DAY, user_id: USER, vehicle_id: 'v1', plate: 'LUR324',
      unit_number: '5422241', owning_area: '8199', rental_class: 'B5',
      status: 'A', lot_row: '5', note: '', seq: 0,
    });
  });

  // ⚠️ A car FG has never met is still a car on his sheet — the paper never refuses one.
  it('keeps a hand-entered car on its plate, with a null vehicle', () => {
    const row = toArchiveRow(entry({ vehicleId: null, unitNumber: null, rentalClass: null }), DAY, USER, 3);
    expect(row.vehicle_id).toBeNull();
    expect(row.plate).toBe('LUR324');
    expect(row.seq).toBe(3);
  });
});

describe('planArchive', () => {
  it('writes every row on a first pass, and reports the high-water mark', () => {
    const all = [entry({ id: 'a', at: 10 }), entry({ id: 'b', at: 20 })];
    const plan = planArchive(all, DAY, USER, 0);
    expect(plan.upserts.map(r => r.id)).toEqual(['a', 'b']);
    expect(plan.deletes).toEqual([]);
    expect(plan.highWater).toBe(20);
  });

  // ⭐ The whole point of riding `at`: a 57-car sheet pushes 57 rows once, then one row per edit.
  it('writes only what changed since the last mark', () => {
    const all = [entry({ id: 'a', at: 10 }), entry({ id: 'b', at: 30 })];
    const plan = planArchive(all, DAY, USER, 20);
    expect(plan.upserts.map(r => r.id)).toEqual(['b']);
    expect(plan.highWater).toBe(30);
  });

  it('does nothing when nothing moved', () => {
    const all = [entry({ id: 'a', at: 10 })];
    const plan = planArchive(all, DAY, USER, 10);
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.highWater).toBe(10);
  });

  // ⚠️ A removed row must reach the archive as a DELETE. "Sometimes drivers need a vehicle that i've
  // already written up" — the car left; the archive has to agree with the sheet he actually wrote.
  it('sends a tombstoned row to deletes, not upserts', () => {
    const all = [entry({ id: 'a', at: 10 }), entry({ id: 'b', at: 30, deleted: true })];
    const plan = planArchive(all, DAY, USER, 20);
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual(['b']);
  });

  // ⭐⭐ THE PAPER'S GRAMMAR. His Sept 1 sheet pulls row 4 twice in one close — two separate ring
  // groups. seq is the only thing that keeps them apart; grouping by status would flatten them.
  it('numbers rows by their position in the full array, so two pulls of one row stay distinct', () => {
    const all = [
      entry({ id: 'a', at: 10, row: '4' }),
      entry({ id: 'b', at: 10, row: '5' }),
      entry({ id: 'c', at: 10, row: '4' }),
    ];
    const plan = planArchive(all, DAY, USER, 0);
    expect(plan.upserts.map(r => [r.id, r.lot_row, r.seq])).toEqual([
      ['a', '4', 0], ['b', '5', 1], ['c', '4', 2],
    ]);
  });

  // ⚠️ `removeAt` tombstones rather than splices, so indices are stable — which is exactly what makes
  // seq trustworthy. A visible-only index would renumber every later row on a removal.
  it('keeps seq stable when an earlier row is tombstoned', () => {
    const all = [
      entry({ id: 'a', at: 50, deleted: true }),
      entry({ id: 'b', at: 10 }),
    ];
    const plan = planArchive(all, DAY, USER, 0);
    expect(plan.upserts.map(r => [r.id, r.seq])).toEqual([['b', 1]]);
    expect(plan.deletes).toEqual(['a']);
  });

  // The high-water mark must advance past a tombstone too, or the delete replays forever.
  it('advances the mark past a tombstone', () => {
    const all = [entry({ id: 'a', at: 90, deleted: true })];
    expect(planArchive(all, DAY, USER, 0).highWater).toBe(90);
  });
});
