import { describe, it, expect } from 'vitest';
import {
  ASSET_LABEL,
  ASSET_ICON,
  lentOutBy,
  borrowedByUnit,
  isAssetLentOut,
} from '../../src/lib/evAssetLoans';
import type { EvAssetLoan } from '../../src/types';

const loan = (over: Partial<EvAssetLoan> = {}): EvAssetLoan =>
  ({
    id: 'l1',
    status: 'out',
    assetType: 'cable',
    lenderVehicleId: 'lender',
    borrowerUnit: '101',
    ...over,
  } as EvAssetLoan);

describe('asset label/icon maps', () => {
  it('label and icon cover both assets', () => {
    expect(ASSET_LABEL).toEqual({ cable: 'Charge cable', adapter: 'J1772 adapter' });
    expect(Object.keys(ASSET_ICON).sort()).toEqual(['adapter', 'cable']);
  });
});

describe('lentOutBy', () => {
  it('returns only open loans where the vehicle is the lender', () => {
    const loans = [
      loan({ id: 'a', lenderVehicleId: 'v1' }),
      loan({ id: 'b', lenderVehicleId: 'v2' }),
      loan({ id: 'c', lenderVehicleId: 'v1', status: 'returned' }),
    ];
    expect(lentOutBy(loans, 'v1').map(l => l.id)).toEqual(['a']);
  });
});

describe('borrowedByUnit', () => {
  it('matches open loans by borrower unit#', () => {
    const loans = [
      loan({ id: 'a', borrowerUnit: '101' }),
      loan({ id: 'b', borrowerUnit: '202' }),
      loan({ id: 'c', borrowerUnit: '101', status: 'returned' }),
    ];
    expect(borrowedByUnit(loans, '101').map(l => l.id)).toEqual(['a']);
  });

  it('returns nothing for a null/blank unit (unregistered borrower)', () => {
    expect(borrowedByUnit([loan()], null)).toEqual([]);
    expect(borrowedByUnit([loan()], undefined)).toEqual([]);
  });
});

describe('isAssetLentOut', () => {
  it('is true only when that specific asset is out from the vehicle', () => {
    const loans = [loan({ lenderVehicleId: 'v1', assetType: 'cable' })];
    expect(isAssetLentOut(loans, 'v1', 'cable')).toBe(true);
    expect(isAssetLentOut(loans, 'v1', 'adapter')).toBe(false);
    expect(isAssetLentOut(loans, 'v2', 'cable')).toBe(false);
  });
});
