import { describe, it, expect } from 'vitest';
import { backAction, depthOf, ROOT_DEPTH } from '../../src/lib/screenRouting';

// "← Back" from a vehicle opened out of Fleet Master was landing him in Holds, because every back
// button pushed the dashboard instead of popping the stack FG already maintains (Aaron, 2026-08-22).

describe('depthOf', () => {
  it('treats a missing or unstamped state as the root', () => {
    expect(depthOf(null)).toBe(ROOT_DEPTH);
    expect(depthOf(undefined)).toBe(ROOT_DEPTH);
    expect(depthOf({ appRoot: true })).toBe(ROOT_DEPTH);
  });

  it('reads the stamped depth', () => {
    expect(depthOf({ name: 'vehicle', _depth: 3 })).toBe(3);
  });
});

describe('backAction', () => {
  it('⭐ pops when there is a real screen behind — whichever module it was', () => {
    // Fleet → vehicle is depth 2. Popping is the only thing that can know it was Fleet.
    expect(backAction({ name: 'vehicle', _depth: 2 })).toBe('pop');
    expect(backAction({ name: 'vehicle', _depth: 9 })).toBe('pop');
  });

  it('⭐ falls back at depth 1 — popping there would ask him to log out', () => {
    // A deep link, a fresh login, or a refresh straight onto a record. Behind that entry is the
    // app-root sentinel, and the popstate handler answers root with the log-out prompt. Raising
    // that from a button labelled Back would be a hard no.
    expect(backAction({ name: 'vehicle', _depth: 1 })).toBe('fallback');
  });

  it('falls back on an unstamped stack rather than guessing', () => {
    expect(backAction(null)).toBe('fallback');
    expect(backAction({ appRoot: true })).toBe('fallback');
  });
});
