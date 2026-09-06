// Cross-device reconciliation for the closing sheet.
//
// ⚠️ WHY THIS EXISTS: whole-list last-write-wins is not merely a coarser merge here, it is
// DESTRUCTIVE. Aaron scanned 24 cars on his phone at the yard (2026-09-05) and opened FG on his PC
// at home; under LWW the PC's empty sheet would have been the last write. `b93ccda` already fixed
// exactly this on the Airport Flip — this is the same rule, tested against the same failure.
import { describe, it, expect } from 'vitest';
import { mergeEntries, sameEntries, visibleEntries } from '../../src/lib/closingInventoryMerge';
import type { InventoryEntry } from '../../src/lib/closingInventory';

const e = (id: string, at: number, over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id, at, vehicleId: null, plate: id, unitNumber: null, owningArea: null,
  rentalClass: null, status: 'A', row: '', note: '', ...over,
});

const yardSheet = Array.from({ length: 24 }, (_, i) => e(`car${i}`, 1000 + i));

describe('mergeEntries — a device that knows nothing must not erase a device that knows 24 cars', () => {
  it('⚠️ an empty server contributes nothing — the scanned sheet survives', () => {
    expect(mergeEntries(yardSheet, [])).toHaveLength(24);
  });

  it("⚠️ an empty local ADOPTS the server's sheet — this is the PC at home", () => {
    const merged = mergeEntries([], yardSheet);
    expect(merged).toHaveLength(24);
    expect(merged.map(r => r.id)).toEqual(yardSheet.map(r => r.id));
  });

  it('takes the strictly-newer row per id, not the newer LIST', () => {
    const local  = [e('a', 5, { note: 'local'  }), e('b', 9, { note: 'keep mine' })];
    const server = [e('a', 7, { note: 'server' }), e('b', 2, { note: 'stale'     })];
    const m = mergeEntries(local, server);
    expect(m.find(r => r.id === 'a')?.note).toBe('server');   // server newer → wins
    expect(m.find(r => r.id === 'b')?.note).toBe('keep mine');// local newer → survives
  });

  it('a tie keeps the local row — deterministic, no clock-skew tiebreaker', () => {
    expect(mergeEntries([e('a', 5, { note: 'mine' })], [e('a', 5, { note: 'theirs' })])[0].note).toBe('mine');
  });

  it('keeps this device\'s order and appends only what the server alone had', () => {
    const m = mergeEntries([e('a', 1), e('b', 1)], [e('b', 1), e('c', 1)]);
    expect(m.map(r => r.id)).toEqual(['a', 'b', 'c']);   // never reshuffles under him mid-pile
  });

  it('⚠️ a tombstone is not resurrected by the other side\'s stale copy', () => {
    const local  = [e('a', 9, { deleted: true })];   // he removed it — a driver took the car
    const server = [e('a', 3)];                      // the other device never saw the removal
    expect(mergeEntries(local, server)[0].deleted).toBe(true);
    expect(visibleEntries(mergeEntries(local, server))).toHaveLength(0);
  });

  it('a tombstone TRAVELS — the other device learns about the removal', () => {
    const merged = mergeEntries([e('a', 3)], [e('a', 9, { deleted: true })]);
    expect(visibleEntries(merged)).toHaveLength(0);
  });

  it('is idempotent and commutative, which is what makes refocus re-pulls safe', () => {
    const a = [e('x', 4), e('y', 8)];
    const b = [e('y', 2), e('z', 6)];
    const once = mergeEntries(a, b);
    expect(sameEntries(mergeEntries(once, b), once)).toBe(true);              // idempotent
    const ids = (rows: InventoryEntry[]) => [...rows.map(r => r.id)].sort();
    expect(ids(mergeEntries(a, b))).toEqual(ids(mergeEntries(b, a)));         // commutative on content
  });
});

describe('sameEntries — stops two devices ping-ponging reconciliations', () => {
  it('is true only when the same rows sit at the same versions', () => {
    expect(sameEntries([e('a', 1)], [e('a', 1)])).toBe(true);
    expect(sameEntries([e('a', 1)], [e('a', 2)])).toBe(false);
    expect(sameEntries([e('a', 1)], [e('a', 1), e('b', 1)])).toBe(false);
  });
});

describe('visibleEntries — tombstones never leave the store/sync/hook', () => {
  it('hides deleted rows and keeps the rest in order', () => {
    expect(visibleEntries([e('a', 1), e('b', 1, { deleted: true }), e('c', 1)]).map(r => r.id))
      .toEqual(['a', 'c']);
  });
});
