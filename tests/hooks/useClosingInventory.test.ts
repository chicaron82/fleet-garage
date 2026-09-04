// ⭐ The two carries are what this hook exists for, and they behave differently. These tests are
// aimed squarely at the mistakes Aaron already caught once on the mock.
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ⚠️ THE SESSION IS PERSISTED NOW, so every test starts by wiping it. Without this the suite becomes
// order-dependent overnight: a hook that used to mount empty inherits whatever the previous test
// left behind. Surfaced the moment persistence landed — six tests went red at once.
import { useClosingInventory } from '../../src/hooks/useClosingInventory';
import { handEntry, type InventoryEntry } from '../../src/lib/closingInventory';

beforeEach(() => localStorage.clear());

const available = (plate: string, row: string): InventoryEntry => ({
  ...handEntry(plate, 'A'), row,
});

describe('useClosingInventory', () => {
  it('starts with nothing carried — the first car pre-picks no status', () => {
    const { result } = renderHook(() => useClosingInventory());
    expect(result.current.carriedStatus).toBeNull();
    expect(result.current.carriedRow).toBe('');
    expect(result.current.entries).toEqual([]);
  });

  it('the status CARRIES to the next car — a run of one status is the shape of the work', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => result.current.commit(handEntry('ABC123', 'D')));
    expect(result.current.carriedStatus).toBe('D');
  });

  it('the row carries only for an AVAILABLE car', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => result.current.commit(available('ABC123', '5')));
    expect(result.current.carriedRow).toBe('5');
    // ⚠️ A dirty car's note is a reason, not a place — it must not clear or claim the row carry.
    act(() => result.current.commit(handEntry('DEF456', 'D')));
    expect(result.current.carriedRow).toBe('5');
    expect(result.current.carriedStatus).toBe('D');
  });

  it('⭐ the TALLY is where cars are, not the row he last used — the bug he caught on his phone', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => {
      result.current.commit(available('AAA111', '4'));
      result.current.commit(available('BBB222', '5'));
      result.current.commit(available('CCC333', '5'));
    });
    // The carry is one row…
    expect(result.current.carriedRow).toBe('5');
    // …but the sheet holds available cars in two, and the tally says so.
    const rows = result.current.tally.map(t => `${t.row}:${t.count}`);
    expect(rows).toContain('4:1');
    expect(rows).toContain('5:2');
  });

  it('counts only AVAILABLE cars toward a row — a dirty car is not parked anywhere', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => {
      result.current.commit(available('AAA111', '4'));
      result.current.commit({ ...handEntry('BBB222', 'D'), row: '4' });
    });
    expect(result.current.filled['4']).toBe(1);
  });

  it('a car added by hand lands on the sheet and sets the carry — the paper never refuses a car', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => result.current.addByHand('zzz999', 'M'));
    expect(result.current.entries[0]?.plate).toBe('ZZZ999');
    expect(result.current.entries[0]?.vehicleId).toBeNull();
    expect(result.current.carriedStatus).toBe('M');
  });

  it('removing and clearing behave — clear resets both carries, not just the rows', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => {
      result.current.commit(available('AAA111', '4'));
      result.current.commit(available('BBB222', '5'));
    });
    act(() => result.current.removeAt(0));
    expect(result.current.entries).toHaveLength(1);
    act(() => result.current.clear());
    expect(result.current.entries).toEqual([]);
    expect(result.current.carriedStatus).toBeNull();
    expect(result.current.carriedRow).toBe('');
  });
});

// ⭐ Undo-last and removeAt are NOT the same operation. Undo is "I entered that wrong"; removeAt is
// *"sometimes drivers need a vehicle that i've already written up"* — the world changed.
describe('undoLast', () => {
  it('takes the last row straight back off', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => { result.current.addByHand('AAA111', 'A'); });
    act(() => { result.current.addByHand('BBB222', 'D'); });
    expect(result.current.entries).toHaveLength(2);
    act(() => { result.current.undoLast(); });
    expect(result.current.entries.map(e => e.plate)).toEqual(['AAA111']);
  });

  // ⚠️ He is mid-pile either way. Resetting the status he is carrying because he fixed a typo would
  // make him re-pick it for the very next car.
  it('leaves the carried status alone — a typo does not change which pile he is holding', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => { result.current.addByHand('AAA111', 'D'); });
    act(() => { result.current.undoLast(); });
    expect(result.current.carriedStatus).toBe('D');
  });

  it('is harmless on an empty sheet', () => {
    const { result } = renderHook(() => useClosingInventory());
    act(() => { result.current.undoLast(); });
    expect(result.current.entries).toEqual([]);
  });
});

// ⚠️⚠️ THE SHEET MUST SURVIVE THE APP BEING KILLED. The airport flip lost live data to exactly this
// on 2026-07-19 (sessionStorage dies with the process, Android reclaims a backgrounded PWA), and
// this surface carried the same risk on a write-up that runs to 57 cars.
describe('the sheet survives a remount', () => {

  it('restores the rows AND the carries', () => {
    const first = renderHook(() => useClosingInventory());
    act(() => { first.result.current.addByHand('AAA111', 'A'); });
    act(() => { first.result.current.commit({ ...first.result.current.entries[0]!, plate: 'BBB222', status: 'A', row: '5' }); });
    first.unmount();

    // A fresh mount is what a reload, or the OS killing and relaunching the PWA, actually looks like.
    const second = renderHook(() => useClosingInventory());
    expect(second.result.current.entries.map(e => e.plate)).toEqual(['AAA111', 'BBB222']);
    expect(second.result.current.carriedStatus).toBe('A');
    expect(second.result.current.carriedRow).toBe('5');
  });

  // ⚠️ Clearing must survive the reload too, or the destructive button silently undoes itself.
  it('stays cleared after clear()', () => {
    const first = renderHook(() => useClosingInventory());
    act(() => { first.result.current.addByHand('AAA111', 'A'); });
    act(() => { first.result.current.clear(); });
    first.unmount();

    const second = renderHook(() => useClosingInventory());
    expect(second.result.current.entries).toEqual([]);
    expect(second.result.current.carriedStatus).toBeNull();
  });
});
