import { describe, it, expect } from 'vitest';
import { initialsOf, agoLabel, lotPageOf } from '../../src/lib/lotLookout';

describe('labels', () => {
  it('initials and ages read the way the board shows them', () => {
    expect(initialsOf('Larry J')).toBe('LJ');
    expect(initialsOf('AS')).toBe('AS');
    expect(initialsOf(null)).toBe('');
    expect(agoLabel(null)).toBe('never');
    expect(agoLabel(0)).toBe('just now');
    expect(agoLabel(135)).toBe('2h 15m ago');
  });
});

describe('lotPageOf', () => {
  it('the Lot Lookout pages, trailing slash or not', () => {
    // ⭐ /lot was the drivers' airport page; since 2026-10-29 it lands on the read-only bay, never a dead link.
    expect(lotPageOf('/lot')).toBe('view');
    expect(lotPageOf('/lot/')).toBe('view');
    expect(lotPageOf('/lot/erin')).toBe('erin');
    expect(lotPageOf('/lot/Erin/')).toBe('erin');
    expect(lotPageOf('/lot/view')).toBe('view');
  });
  it('⚠️ everything else is FG, behind its login', () => {
    for (const p of ['/', '/lots', '/lot/other', '/my-day', '/lotview', '/x/lot']) expect(lotPageOf(p)).toBeNull();
  });
});
