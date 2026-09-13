import { describe, it, expect } from 'vitest';
import { linkUnlinked, type LinkableCar } from '../../src/lib/closingInventoryMerge';
import type { InventoryEntry } from '../../src/lib/closingInventory';

const entry = (o: Partial<InventoryEntry> & { id: string; plate: string }): InventoryEntry => ({
  at: 1000, deleted: false, vehicleId: null, unitNumber: null, owningArea: null,
  rentalClass: null, status: 'D', row: '', note: '', ...o,
});

const car = (o: Partial<LinkableCar> & { id: string; licensePlate: string }): LinkableCar => ({
  unitNumber: null, owningArea: null, rentalClass: null, archivedAt: null, ...o,
});

// The night it happened: typed onto the sheet, then registered four minutes later.
const LUR479 = car({ id: 'v1', licensePlate: 'LUR479', unitNumber: '5429667', owningArea: '8199', rentalClass: 'B4' });

describe('linkUnlinked', () => {
  it('⭐ adopts the hand-typed row once FG knows the car', () => {
    const [row] = linkUnlinked([entry({ id: 'e1', plate: 'LUR479' })], [LUR479], 9000);
    expect(row.vehicleId).toBe('v1');
    expect(row.unitNumber).toBe('5429667');
    expect(row.owningArea).toBe('8199');
    expect(row.rentalClass).toBe('B4');
  });

  it('⚠️ moves `at`, or the heal is invisible to the hook and never persists', () => {
    // sameEntries compares id and `at` ALONE — an untouched clock means no re-render, no push.
    const [row] = linkUnlinked([entry({ id: 'e1', plate: 'LUR479', at: 1000 })], [LUR479], 9000);
    expect(row.at).toBe(9000);
  });

  it('⭐ is idempotent — a linked row is never touched again', () => {
    const linked = linkUnlinked([entry({ id: 'e1', plate: 'LUR479' })], [LUR479], 9000);
    expect(linkUnlinked(linked, [LUR479], 12345)).toBe(linked);   // same reference, no churn
  });

  it('returns the SAME array when nothing is orphaned, so the hook does not re-render', () => {
    const all = [entry({ id: 'e1', plate: 'LUR479', vehicleId: 'v1' })];
    expect(linkUnlinked(all, [LUR479])).toBe(all);
  });

  it('⚠️ leaves an AMBIGUOUS plate alone rather than guessing', () => {
    // Collisions are reported, never resolved — same rule the VIN backfill runs on.
    const twins = [car({ id: 'a', licensePlate: 'LUR479' }), car({ id: 'b', licensePlate: 'LUR479' })];
    const [row] = linkUnlinked([entry({ id: 'e1', plate: 'LUR479' })], twins);
    expect(row.vehicleId).toBeNull();
  });

  it('falls back to the unit number when the plate does not match', () => {
    // The plate is the only key handEntry leaves, but an imported row has a unit and may carry a misread plate.
    const [row] = linkUnlinked([entry({ id: 'e1', plate: 'LUR47Q', unitNumber: '5429667' })], [LUR479], 9000);
    expect(row.vehicleId).toBe('v1');
    expect(row.plate).toBe('LUR479');   // FG's spelling wins once it owns the row
  });

  it('⚠️ an archived car never adopts a live row', () => {
    const gone = car({ id: 'z', licensePlate: 'LUR479', archivedAt: '2026-09-01T00:00:00Z' });
    expect(linkUnlinked([entry({ id: 'e1', plate: 'LUR479' })], [gone])[0].vehicleId).toBeNull();
  });

  it('ignores tombstones — a deleted row has nothing to heal', () => {
    const all = [entry({ id: 'e1', plate: 'LUR479', deleted: true })];
    expect(linkUnlinked(all, [LUR479])).toBe(all);
  });

  it('normalizes spacing and case before matching', () => {
    const [row] = linkUnlinked([entry({ id: 'e1', plate: ' lur 479 ' })], [LUR479], 9000);
    expect(row.vehicleId).toBe('v1');
  });

  it('never overwrites a value the sheet already carries', () => {
    // The operator's own entry outranks FG's record for the fields he filled in himself.
    const typed = entry({ id: 'e1', plate: 'LUR479', unitNumber: '9999999', rentalClass: 'Q4' });
    const [row] = linkUnlinked([typed], [LUR479], 9000);
    expect(row.unitNumber).toBe('9999999');
    expect(row.rentalClass).toBe('Q4');
    expect(row.owningArea).toBe('8199');   // …but fills the ones he left blank
  });
});
