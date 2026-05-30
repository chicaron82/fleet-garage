import { describe, it, expect, beforeEach } from 'vitest';
import {
  canSetOverride,
  loadOverrides,
  toggleOverride,
  toggleGroupOverride,
  clearAllOverrides,
} from '../../src/lib/classOverrides';

beforeEach(() => {
  localStorage.clear();
});

// ── canSetOverride ────────────────────────────────────────────────────────────

describe('canSetOverride', () => {
  it('allows leads, counter, and management', () => {
    for (const role of ['Lead VSA', 'CSR', 'Branch Manager', 'Operations Manager', 'City Manager'] as const) {
      expect(canSetOverride(role)).toBe(true);
    }
  });

  it('denies floor VSAs and drivers', () => {
    expect(canSetOverride('VSA')).toBe(false);
    expect(canSetOverride('Driver')).toBe(false);
  });
});

// ── toggle / load / clear (localStorage round-trip) ──────────────────────────

describe('class override persistence', () => {
  it('starts empty', () => {
    expect(loadOverrides().size).toBe(0);
  });

  it('toggles a class on and back off', () => {
    let set = toggleOverride('B4');
    expect(set.has('B4')).toBe(true);
    expect(loadOverrides().has('B4')).toBe(true); // persisted

    set = toggleOverride('B4');
    expect(set.has('B4')).toBe(false);
    expect(loadOverrides().has('B4')).toBe(false);
  });

  it('toggleGroupOverride adds the whole group, then removes it when all active', () => {
    let set = toggleGroupOverride(['B4', 'B5']);
    expect(set.has('B4')).toBe(true);
    expect(set.has('B5')).toBe(true);

    set = toggleGroupOverride(['B4', 'B5']); // all active → clear them
    expect(set.has('B4')).toBe(false);
    expect(set.has('B5')).toBe(false);
  });

  it('toggleGroupOverride fills the group when only partially active', () => {
    toggleOverride('B4');                       // B4 on, B5 off
    const set = toggleGroupOverride(['B4', 'B5']); // not all active → add all
    expect(set.has('B4')).toBe(true);
    expect(set.has('B5')).toBe(true);
  });

  it('clearAllOverrides wipes the day', () => {
    toggleOverride('B4');
    clearAllOverrides();
    expect(loadOverrides().size).toBe(0);
  });
});
