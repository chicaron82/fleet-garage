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
    // Past a day it reads in days and whole hours (Friday 23:23 seen Sunday 22:29 was "47h 6m ago").
    expect(agoLabel(1439)).toBe('23h 59m ago');
    expect(agoLabel(1440)).toBe('1d ago');
    expect(agoLabel(2826)).toBe('1d 23h ago');
    expect(agoLabel(2880)).toBe('2d ago');
  });
});

describe('lotPageOf', () => {
  it('the Lot Lookout pages, trailing slash or not', () => {
    // ⭐ /lot was the drivers' airport page; since 2026-10-29 it lands on the read-only bay, never a dead link.
    // ⭐ /lot/erin was Erin St's count behind the shared PIN; since 2026-11-05 it lands there too.
    expect(lotPageOf('/lot')).toBe('view');
    expect(lotPageOf('/lot/')).toBe('view');
    expect(lotPageOf('/lot/erin')).toBe('view');
    expect(lotPageOf('/lot/Erin/')).toBe('view');
    expect(lotPageOf('/lot/view')).toBe('view');
  });
  it('⚠️ everything else is FG, behind its login', () => {
    for (const p of ['/', '/lots', '/lot/other', '/my-day', '/lotview', '/x/lot']) expect(lotPageOf(p)).toBeNull();
  });
});
