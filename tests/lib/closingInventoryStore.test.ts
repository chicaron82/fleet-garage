// The closing write-up, persisted.
//
// ⚠️⚠️ WHY IT EXISTS, and it is not hypothetical: the airport flip shipped its session in
// sessionStorage and Aaron lost live data to it on 2026-07-19 — sessionStorage dies with the
// PROCESS, not the shift, Android reclaimed the backgrounded PWA, and his card showed 2 flips where
// he had recorded about 7. The closing inventory carried the same risk in a worse place: plain
// useState, nothing persisted, on a write-up that runs to 57 cars.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSession, saveSession, clearSession, normalizeEntry, EMPTY_SESSION } from '../../src/lib/closingInventoryStore';
import type { InventoryEntry } from '../../src/lib/closingInventory';

const entry = (over: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id: 'e1', at: 1,
  vehicleId: 'v1', plate: 'LUR306', unitNumber: '5422795', owningArea: '8199',
  rentalClass: 'C', status: 'A', row: '5', note: '', ...over,
});

beforeEach(() => localStorage.clear());

describe('the persisted session', () => {
  it('comes back after a reload, rows and carries together', () => {
    saveSession('2026-09-04', { entries: [entry(), entry({ plate: 'LFJ400' })], carriedStatus: 'A', carriedRow: '5' });
    const back = loadSession('2026-09-04');
    expect(back.entries.map(e => e.plate)).toEqual(['LUR306', 'LFJ400']);
    // ⭐ The carries matter as much as the rows: losing "I am carrying A · R-5" mid-pile would make
    // him re-pick the status and the row for the very next car.
    expect(back.carriedStatus).toBe('A');
    expect(back.carriedRow).toBe('5');
  });

  // ⚠️ THE EXPIRY COMES FROM THE DAY STAMP, not from the storage type — that is the whole lesson the
  // flip paid for. A sheet from a previous shift must never reappear mid-write-up.
  it('⚠️ reads as empty on a different shift day', () => {
    saveSession('2026-09-03', { entries: [entry()], carriedStatus: 'D', carriedRow: '4' });
    expect(loadSession('2026-09-04')).toEqual(EMPTY_SESSION);
  });

  it('is empty when nothing was ever stored', () => {
    expect(loadSession('2026-09-04')).toEqual(EMPTY_SESSION);
  });

  // ⚠️ Clearing the sheet must clear the STORE too, or the next reload undoes it — the most
  // confusing possible outcome of a destructive button.
  it('clears the store, so "Clear the sheet" survives a reload', () => {
    saveSession('2026-09-04', { entries: [entry()], carriedStatus: 'A', carriedRow: '5' });
    clearSession();
    expect(loadSession('2026-09-04')).toEqual(EMPTY_SESSION);
  });

  // ⚠️ A write-up must not fail to OPEN because a cache could not be read.
  it('never throws on a corrupt payload', () => {
    localStorage.setItem('fg_closing_inventory', '{not json');
    expect(() => loadSession('2026-09-04')).not.toThrow();
    expect(loadSession('2026-09-04')).toEqual(EMPTY_SESSION);
  });

  it('ignores a stored status that is not one of the five', () => {
    localStorage.setItem('fg_closing_inventory', JSON.stringify({ day: '2026-09-04', entries: [], carriedStatus: 'X', carriedRow: 7 }));
    const back = loadSession('2026-09-04');
    expect(back.carriedStatus).toBeNull();
    expect(back.carriedRow).toBe('');
  });
});

// ⚠️ The real fix for "added a field to a persisted shape". A row written by an older build can lack
// a field added since, and a bare `.trim()` on it crashed the whole My Shift render for the flip on
// 2026-07-17. An old payload may be incomplete; it must never be fatal.
describe('loadSession — healed ids must survive the load that minted them', () => {
  // ⚠️⚠️ THE REGRESSION THIS GUARDS. `normalizeEntry` mints a fresh id for a pre-sync row, and
  // `loadSession` runs on every mount. Without writing the healed session back, Aaron's 24-row
  // sheet would present 24 NEW ids on each load, and the per-row merge — which reconciles by id —
  // would append the entire sheet to the server copy every single time.
  const legacy = JSON.stringify({
    day: '2026-09-05',
    entries: [{ plate: 'LUR402', status: 'B' }, { plate: 'LUR401', status: 'B' }],
    carriedStatus: 'B', carriedRow: '',
  });

  it('assigns ids to a pre-sync payload and keeps them stable across reloads', () => {
    localStorage.setItem('fg_closing_inventory', legacy);
    const first  = loadSession('2026-09-05');
    const second = loadSession('2026-09-05');
    expect(first.entries.map(e => e.id)).toEqual(second.entries.map(e => e.id));
    expect(new Set(first.entries.map(e => e.id)).size).toBe(2);   // and unique per row
  });

  it('keeps the rows themselves intact while healing them', () => {
    localStorage.setItem('fg_closing_inventory', legacy);
    const s = loadSession('2026-09-05');
    expect(s.entries.map(e => e.plate)).toEqual(['LUR402', 'LUR401']);
    expect(s.carriedStatus).toBe('B');
  });

  it('a stale shift day still reads as empty — sync did not change the expiry', () => {
    localStorage.setItem('fg_closing_inventory', legacy);
    expect(loadSession('2026-09-06')).toEqual(EMPTY_SESSION);
  });
});

describe('normalizeEntry', () => {
  it('heals a row saved by an older build into the current shape', () => {
    const healed = normalizeEntry({ plate: 'LUR999' });
    expect(healed).toMatchObject({
      vehicleId: null, plate: 'LUR999', unitNumber: null, owningArea: null,
      rentalClass: null, status: 'A', row: '', note: '',
    });
    // The fields the sheet calls .trim() on are strings, always.
    expect(() => healed.note.trim() + healed.row.trim() + healed.plate.trim()).not.toThrow();
  });

  // ⭐ The sync fields, added 2026-09-06. A row written before cross-device sync existed has none of
  // them, and every one of these defaults is load-bearing.
  it('mints an id, stamps the row as the OLDEST, and is not a tombstone', () => {
    const healed = normalizeEntry({ plate: 'LUR999' });
    expect(typeof healed.id).toBe('string');
    expect(healed.id.length).toBeGreaterThan(0);
    // ⚠️ 0, never Date.now(). A legacy row is the oldest thing on the sheet, so any real edit on any
    // device beats it. Stamping it "now" on each read would make it perpetually win every merge.
    expect(healed.at).toBe(0);
    expect(healed.deleted).toBe(false);
  });

  it('⚠️⚠️ mints a DIFFERENT id each call — which is why loadSession must persist the healed rows', () => {
    // This is not a defect, it is the constraint: normalizeEntry runs on every load, so if the
    // healed ids were never written back, the same 24 rows would arrive with 24 fresh ids each time
    // and the per-row merge would duplicate the whole sheet on contact with the server.
    expect(normalizeEntry({ plate: 'LUR999' }).id).not.toBe(normalizeEntry({ plate: 'LUR999' }).id);
  });

  it('rejects a status outside the form legend', () => {
    expect(normalizeEntry({ status: 'Z' as InventoryEntry['status'] }).status).toBe('A');
  });

  it('survives a completely empty object', () => {
    expect(() => normalizeEntry({})).not.toThrow();
  });
});
