import { describe, it, expect } from 'vitest';
import { scanHoldLines, flaggedOnLabel } from '../../src/lib/scanHoldSummary';
import type { Hold } from '../../src/types';

const hold = (o: Partial<Hold>): Hold => ({
  id: 'h1', vehicleId: 'v1',
  holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Windshield chip',
  flaggedById: 'u1', flaggedByName: 'Aaron S.', flaggedByEmployeeId: '331965',
  flaggedAt: '2026-08-12T10:00:00Z',
  notes: '', status: 'ACTIVE', branchId: 'YWG',
  ...o,
} as Hold);

describe('scanHoldLines', () => {
  it('surfaces WHAT is wrong, not just that something is', () => {
    // The whole point: the card used to render a count and drop the description.
    const [line] = scanHoldLines([hold({})], 'v1');
    expect(line.typeLabel).toBe('Damage');
    expect(line.detail).toBe('Windshield chip');
  });

  it('joins a multi-type hold into one label', () => {
    const [line] = scanHoldLines([hold({ holdTypes: ['damage', 'detail'] })], 'v1');
    expect(line.typeLabel).toBe('Damage + Detail');
  });

  it('returns LIVE holds for THIS vehicle — active AND released', () => {
    const holds = [
      hold({ id: 'a' }),                              // ACTIVE — held right now
      hold({ id: 'r', status: 'RELEASED' }),          // out on exception — carrying it RIGHT NOW
      hold({ id: 'b', status: 'REPAIRED' }),          // history — belongs on the record, not the card
      hold({ id: 'x', status: 'RETURNED' }),          // history
      hold({ id: 'v', status: 'VOIDED' }),            // logged in error
      hold({ id: 'c', vehicleId: 'other' }),          // someone else's car
    ];
    expect(scanHoldLines(holds, 'v1').map(l => l.id).sort()).toEqual(['a', 'r']);
  });

  it('⭐ shows the reason on an OUT-ON-EXCEPTION car — the headline case that was missing', () => {
    // Live regression: 561PIC, a hail car, read "⚠️ On exception" with no reason beside it,
    // because its hold is RELEASED (releasing it is what let the car go out) and the filter was
    // ACTIVE-only. That caught 9 holds out of 422 fleet-wide and blanked exactly the cars that
    // matter most — a car circulating WITH known damage.
    const hail = hold({
      status: 'RELEASED', holdTypes: ['hail'], damageDescription: 'Hail damage',
      release: { releaseType: 'EXCEPTION', actualReturn: undefined } as Hold['release'],
    });
    const [line] = scanHoldLines([hail], 'v1');
    expect(line.typeLabel).toMatch(/hail/i);
    expect(line.detail).toBe('Hail damage');
    expect(line.onException).toBe(true);
  });

  it('puts the NEWEST flag first — the likely reason he is standing there', () => {
    const holds = [
      hold({ id: 'old', flaggedAt: '2026-05-01T10:00:00Z' }),
      hold({ id: 'new', flaggedAt: '2026-08-14T10:00:00Z' }),
    ];
    expect(scanHoldLines(holds, 'v1').map(l => l.id)).toEqual(['new', 'old']);
  });

  it('⭐ flags a hold the car went OUT on — the old-damage-amnesia case', () => {
    // Released as an EXCEPTION with no return recorded = the car is circulating WITH this damage.
    // That's precisely what FG exists to stop being forgotten, so it must be named at the tag.
    const out = hold({
      release: { releaseType: 'EXCEPTION', actualReturn: undefined } as Hold['release'],
    });
    expect(scanHoldLines([out], 'v1')[0].onException).toBe(true);
  });

  it('does NOT call it on-exception once the car has come back', () => {
    const returned = hold({
      release: { releaseType: 'EXCEPTION', actualReturn: '2026-08-15' } as Hold['release'],
    });
    expect(scanHoldLines([returned], 'v1')[0].onException).toBe(false);
  });

  it('survives a hold with no description written', () => {
    expect(scanHoldLines([hold({ damageDescription: '' })], 'v1')[0].detail).toBe('');
  });

  it('returns nothing for a clean car', () => {
    expect(scanHoldLines([], 'v1')).toEqual([]);
  });
});

describe('flaggedOnLabel', () => {
  it('renders a compact date that fits inline', () => {
    expect(flaggedOnLabel('2026-08-12T10:00:00Z')).toMatch(/Aug\s1[12]/);
  });

  it('degrades to empty rather than "Invalid Date"', () => {
    expect(flaggedOnLabel('nope')).toBe('');
  });
});
