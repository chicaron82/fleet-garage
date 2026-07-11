import { describe, it, expect, beforeEach } from 'vitest';
import { loadSidebarPrefs, saveSidebarPrefs, clearSidebarPrefs, type SidebarPrefs } from '../../src/lib/sidebarPrefs';

// Only the localStorage helpers are pure; fetch/sync are Supabase I/O.

beforeEach(() => localStorage.clear());

const prefs: SidebarPrefs = { order: ['holds', 'movement-log'], hidden: ['audits'] };

describe('sidebarPrefs (localStorage)', () => {
  it('returns null before anything is saved', () => {
    expect(loadSidebarPrefs('u1')).toBeNull();
  });

  it('saves and reloads prefs for a user', () => {
    saveSidebarPrefs('u1', prefs);
    expect(loadSidebarPrefs('u1')).toEqual(prefs);
  });

  it('keys prefs per user', () => {
    saveSidebarPrefs('u1', prefs);
    expect(loadSidebarPrefs('u2')).toBeNull();
  });

  it('clears a user’s prefs', () => {
    saveSidebarPrefs('u1', prefs);
    clearSidebarPrefs('u1');
    expect(loadSidebarPrefs('u1')).toBeNull();
  });

  it('returns null on corrupt JSON rather than throwing', () => {
    localStorage.setItem('fg_sidebar_u1', '{not valid json');
    expect(loadSidebarPrefs('u1')).toBeNull();
  });
});
