import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { lentOutBy, borrowedByUnit, ASSET_LABEL, ASSET_ICON } from '../../lib/evAssetLoans';
import { hapticLight } from '../../lib/haptics';
import type { Vehicle } from '../../types';

/**
 * The two sides of EV asset loans for one vehicle: what it has **lent out** (with
 * a one-tap Return that closes the loan and restores the asset) and what it's
 * **holding** for someone else. Shared by the EV Assets tab and the vehicle EV
 * card. Renders nothing when there's no open loan either way.
 */
export function EvLoanSection({ vehicle }: { vehicle: Vehicle }) {
  const { evAssetLoans, returnEvAssetLoan, getVehicleByUnit, getVehicle } = useVehicleHoldContext();
  const [returning, setReturning] = useState<string | null>(null);

  const lentOut = lentOutBy(evAssetLoans, vehicle.id);
  const holding = borrowedByUnit(evAssetLoans, vehicle.unitNumber);
  if (lentOut.length === 0 && holding.length === 0) return null;

  const onReturn = async (loanId: string) => {
    const loan = lentOut.find(l => l.id === loanId);
    if (!loan) return;
    hapticLight();
    setReturning(loanId);
    await returnEvAssetLoan(loan);
    setReturning(null);
  };

  return (
    <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
      {lentOut.map(loan => {
        const borrower = getVehicleByUnit(loan.borrowerUnit);
        return (
          <div key={loan.id} className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2">
            <span className="min-w-0 flex-1 text-xs text-amber-800 dark:text-amber-300">
              {ASSET_ICON[loan.assetType]} <span className="font-semibold">{ASSET_LABEL[loan.assetType]}</span> out → unit {loan.borrowerUnit}
              {!borrower && <span className="text-amber-600/70 dark:text-amber-400/60"> · not in fleet yet</span>}
            </span>
            <button
              type="button"
              onClick={() => onReturn(loan.id)}
              disabled={returning === loan.id}
              className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition cursor-pointer disabled:opacity-50"
            >
              {returning === loan.id ? 'Returning…' : '↩ Returned'}
            </button>
          </div>
        );
      })}

      {holding.map(loan => {
        const lender = getVehicle(loan.lenderVehicleId);
        return (
          <div key={loan.id} className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-900/15 px-3 py-2">
            <span className="text-xs text-blue-800 dark:text-blue-300">
              {ASSET_ICON[loan.assetType]} Holding <span className="font-semibold">unit {lender?.unitNumber ?? '?'}</span>’s {ASSET_LABEL[loan.assetType].toLowerCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
