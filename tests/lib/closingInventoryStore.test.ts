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
describe('normalizeEntry', () => {
  it('heals a row saved by an older build into the current shape', () => {
    const healed = normalizeEntry({ plate: 'LUR999' });
    expect(healed).toEqual({
      vehicleId: null, plate: 'LUR999', unitNumber: null, owningArea: null,
      rentalClass: null, status: 'A', row: '', note: '',
    });
    // The fields the sheet calls .trim() on are strings, always.
    expect(() => healed.note.trim() + healed.row.trim() + healed.plate.trim()).not.toThrow();
  });

  it('rejects a status outside the form legend', () => {
    expect(normalizeEntry({ status: 'Z' as InventoryEntry['status'] }).status).toBe('A');
  });

  it('survives a completely empty object', () => {
    expect(() => normalizeEntry({})).not.toThrow();
  });
});
