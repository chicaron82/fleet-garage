import { describe, it, expect } from 'vitest';
import { decideMint } from '../../src/lib/mintGuard';

describe('decideMint', () => {
  it('MINTS when there is no live match', () => {
    expect(decideMint(undefined, '5420401')).toEqual({ action: 'mint' });
  });

  it('MINTS past an archived match — a returning/re-plated car is a fresh registration', () => {
    expect(decideMint({ id: 'a', unitNumber: '5420401', archivedAt: '2026-07-13T00:00:00Z' }, '5420401'))
      .toEqual({ action: 'mint' });
  });

  it('UPGRADES a plate-only stub in place instead of minting a 2nd row (LFJ370 class)', () => {
    expect(decideMint({ id: 'stub', unitNumber: null }, '5420401')).toEqual({ action: 'upgrade', id: 'stub' });
    expect(decideMint({ id: 'stub', unitNumber: '   ' }, '5420401')).toEqual({ action: 'upgrade', id: 'stub' });
  });

  it('REUSES when the same plate + same unit is already on record (LUR345 / SB085H class)', () => {
    expect(decideMint({ id: 'row', unitNumber: '5422381' }, '5422381')).toEqual({ action: 'reuse', id: 'row' });
    expect(decideMint({ id: 'row', unitNumber: '5422381' }, ' 5422381 ')).toEqual({ action: 'reuse', id: 'row' });
  });

  it('REUSES when the new registration carries no unit — nothing new to add', () => {
    expect(decideMint({ id: 'row', unitNumber: '5422381' }, undefined)).toEqual({ action: 'reuse', id: 'row' });
    expect(decideMint({ id: 'row', unitNumber: '5422381' }, '  ')).toEqual({ action: 'reuse', id: 'row' });
  });

  it('MINTS on same plate + a genuinely different unit — ambiguous at register time, dedupe catches a typo', () => {
    // This is the LUR266 shape (…115 vs …118): we can't tell plate-reuse from a typo here, so allow the
    // mint; the dup sweep is what surfaces a genuine typo.
    expect(decideMint({ id: 'row', unitNumber: '5422115' }, '5422118')).toEqual({ action: 'mint' });
  });
});
