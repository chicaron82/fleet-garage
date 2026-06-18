import { describe, it, expect } from 'vitest';
import { lentOutBy, borrowedByUnit, isAssetLentOut, ASSET_LABEL } from './evAssetLoans';
import type { EvAssetLoan, EvLoanAsset } from '../types';

let seq = 0;
function loan(over: Partial<EvAssetLoan> = {}): EvAssetLoan {
  return {
    id: `l${seq++}`, lenderVehicleId: 'v-lender', assetType: 'adapter',
    borrowerUnit: '5424', status: 'out', notes: null,
    createdAt: '2026-06-18T12:00:00Z', createdBy: 'u1',
    returnedAt: null, returnedBy: null,
    ...over,
  };
}

describe('lentOutBy', () => {
  it('returns this lender\'s OPEN loans only', () => {
    const loans = [
      loan({ id: 'a', lenderVehicleId: 'v-lender' }),
      loan({ id: 'b', lenderVehicleId: 'v-lender', status: 'returned' }),
      loan({ id: 'c', lenderVehicleId: 'v-other' }),
    ];
    expect(lentOutBy(loans, 'v-lender').map(l => l.id)).toEqual(['a']);
  });
});

describe('borrowedByUnit', () => {
  it('matches an open loan by borrower unit#', () => {
    const loans = [loan({ id: 'a', borrowerUnit: '5424' }), loan({ id: 'b', borrowerUnit: '9999' })];
    expect(borrowedByUnit(loans, '5424').map(l => l.id)).toEqual(['a']);
  });
  it('a returned loan is not "held" anymore', () => {
    expect(borrowedByUnit([loan({ borrowerUnit: '5424', status: 'returned' })], '5424')).toEqual([]);
  });
  it('a null/undefined unit (unregistered, no unit#) resolves to nothing', () => {
    expect(borrowedByUnit([loan({ borrowerUnit: '5424' })], null)).toEqual([]);
    expect(borrowedByUnit([loan({ borrowerUnit: '5424' })], undefined)).toEqual([]);
  });
  it('an unregistered borrower unit# simply has no match until that unit exists', () => {
    // The loan to '7777' is recorded; no vehicle has unit 7777 yet → no resolution.
    const loans = [loan({ borrowerUnit: '7777' })];
    expect(borrowedByUnit(loans, '5424')).toEqual([]);
    // …and the day a vehicle registers as 7777, the same query links it.
    expect(borrowedByUnit(loans, '7777').map(l => l.borrowerUnit)).toEqual(['7777']);
  });
});

describe('isAssetLentOut', () => {
  it('is true only for an open loan of that specific asset', () => {
    const loans = [loan({ lenderVehicleId: 'v', assetType: 'cable' })];
    expect(isAssetLentOut(loans, 'v', 'cable')).toBe(true);
    expect(isAssetLentOut(loans, 'v', 'adapter')).toBe(false);
  });
});

describe('ASSET_LABEL', () => {
  it('labels both asset types', () => {
    expect(ASSET_LABEL.cable).toBe('Charge cable');
    expect(ASSET_LABEL.adapter).toBe('J1772 adapter');
    const _exhaustive: Record<EvLoanAsset, string> = ASSET_LABEL;
    expect(Object.keys(_exhaustive)).toHaveLength(2);
  });
});
