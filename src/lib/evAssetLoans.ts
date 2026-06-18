import type { EvAssetLoan, EvLoanAsset } from '../types';

/**
 * EV asset loan reads — the two sides of a structured cross-vehicle lend.
 *
 * A loan names its borrower by **unit# (text)**, matched to a vehicle at read
 * time. So the borrower side resolves the moment a not-yet-registered unit
 * registers, with no backfill — the link was always there, it just had nothing
 * to point at yet.
 */

export const ASSET_LABEL: Record<EvLoanAsset, string> = {
  cable:   'Charge cable',
  adapter: 'J1772 adapter',
};

export const ASSET_ICON: Record<EvLoanAsset, string> = {
  cable:   '🔌',
  adapter: '🔗',
};

/** Open loans where this vehicle is the lender — its asset is currently out. */
export function lentOutBy(loans: EvAssetLoan[], vehicleId: string): EvAssetLoan[] {
  return loans.filter(l => l.status === 'out' && l.lenderVehicleId === vehicleId);
}

/**
 * Open loans where this vehicle's unit# is the borrower — it's holding someone
 * else's asset. Matched on unit#, so an unregistered borrower simply doesn't
 * resolve here until it joins the fleet.
 */
export function borrowedByUnit(loans: EvAssetLoan[], unitNumber: string | null | undefined): EvAssetLoan[] {
  if (!unitNumber) return [];
  return loans.filter(l => l.status === 'out' && l.borrowerUnit === unitNumber);
}

/** Whether this vehicle has the given asset out on loan (to suppress a duplicate lend). */
export function isAssetLentOut(loans: EvAssetLoan[], vehicleId: string, asset: EvLoanAsset): boolean {
  return lentOutBy(loans, vehicleId).some(l => l.assetType === asset);
}
