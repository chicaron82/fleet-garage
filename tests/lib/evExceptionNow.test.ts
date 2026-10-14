import { describe, it, expect } from 'vitest';
import {
  bothEvAssetsPresent, evExceptionHoldsToClose, evExceptionNowClause, isEvAssetsHold,
} from '../../src/lib/evExceptionNow';
import type { Hold } from '../../src/types';

const SEP18 = '2026-09-18T12:59:17Z';
const kit = (cable: boolean | null, adapter: boolean | null, at: string | null = SEP18) =>
  ({ hasMobileCable: cable, hasJ1772Adapter: adapter, evLastUpdatedAt: at });

const hold = (over: Partial<Hold>): Hold => ({
  id: 'h', vehicleId: 'v1', holdTypes: ['missing_accessories'], status: 'RELEASED',
  flaggedAt: '2026-07-20T22:16:00Z', linkedHoldId: null,
  release: { releaseType: 'EXCEPTION', actualReturn: null },
  ...over,
} as unknown as Hold);

describe('evExceptionNowClause', () => {
  // LJF689 on 2026-10-13: released Jul 20 with both missing, adapter found Sep 18.
  it('one found → names it, with the check date, and what is still missing', () => {
    expect(evExceptionNowClause(kit(false, true))).toBe('Now: adapter found Sep 18 · still missing: charge cable');
    expect(evExceptionNowClause(kit(true, false))).toBe('Now: charge cable found Sep 18 · still missing: adapter');
  });

  it('still both missing → nothing to add; the hold text is already true', () => {
    expect(evExceptionNowClause(kit(false, false))).toBe('');
  });

  it('never checked → nothing; unassessed is not news', () => {
    expect(evExceptionNowClause(kit(null, null, null))).toBe('');
  });

  it('one found and the other never assessed → found, with no "still missing" claim', () => {
    expect(evExceptionNowClause(kit(null, true))).toBe('Now: adapter found Sep 18');
  });

  it('both found (the auto-close did not land) → says so and asks for the tap', () => {
    expect(evExceptionNowClause(kit(true, true))).toBe('Now: both found Sep 18 · mark it done');
  });

  it('no check date → the clause still reads, without one', () => {
    expect(evExceptionNowClause(kit(false, true, null))).toBe('Now: adapter found · still missing: charge cable');
  });
});

describe('bothEvAssetsPresent', () => {
  it('only two known trues count — null is never "found"', () => {
    expect(bothEvAssetsPresent(kit(true, true))).toBe(true);
    expect(bothEvAssetsPresent(kit(null, true))).toBe(false);
    expect(bothEvAssetsPresent(kit(true, false))).toBe(false);
  });
});

describe('isEvAssetsHold', () => {
  it('keys on the hold type, not the text', () => {
    expect(isEvAssetsHold({ holdTypes: ['missing_accessories'] })).toBe(true);
    expect(isEvAssetsHold({ holdTypes: ['damage'] })).toBe(false);
  });
});

describe('evExceptionHoldsToClose', () => {
  const jul = hold({ id: 'jul20' });
  const aug = hold({ id: 'aug06', flaggedAt: '2026-08-06T03:00:12Z', linkedHoldId: 'jul20' });

  it('LJF689: a re-hold chain closes through its head only (the repair closes the link)', () => {
    expect(evExceptionHoldsToClose([jul, aug], 'v1').map(h => h.id)).toEqual(['aug06']);
  });

  it('two unlinked EV holds on one car → both', () => {
    const other = hold({ id: 'oct01', flaggedAt: '2026-10-01T00:00:00Z' });
    expect(evExceptionHoldsToClose([jul, other], 'v1').map(h => h.id)).toEqual(['jul20', 'oct01']);
  });

  it('an ACTIVE EV hold (held, never released) is closed too', () => {
    expect(evExceptionHoldsToClose([hold({ id: 'a', status: 'ACTIVE', release: undefined })], 'v1').map(h => h.id))
      .toEqual(['a']);
  });

  it('leaves alone: other cars, other hold types, returned and repaired holds', () => {
    const holds = [
      hold({ id: 'otherCar', vehicleId: 'v2' }),
      hold({ id: 'damage', holdTypes: ['damage'] }),
      hold({ id: 'returned', release: { releaseType: 'EXCEPTION', actualReturn: '2026-09-01T00:00:00Z' } as Hold['release'] }),
      hold({ id: 'repaired', status: 'REPAIRED' }),
    ];
    expect(evExceptionHoldsToClose(holds, 'v1')).toEqual([]);
  });
});
