import type { VehicleStatus, HoldStatus, HoldType, MechanicalSubType, Disposition } from '../../types';
import { holdBadgeConfig } from '../../lib/holdBadge';

// ⚠️⚠️ SALE_CAR BORROWS ITS LABEL FROM `holdBadgeConfig` — it does not get its own copy. On the Holds
// list a car's badge only comes from its hold type when the vehicle is HELD; a sale car's status is
// SALE_CAR, so it lands HERE instead. This row said a hand-typed 'Sale Car' while the hold-type badge
// became '🏷️ Sale Car', and the version Aaron actually sees — 32 of them on one list — stayed bare.
// Found 2026-09-14 by rendering the list as his VSA account after the badge change had gone green.
// One word, one definition.
const VEHICLE_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  HELD:               { label: 'Held',             className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' },
  OUT_ON_EXCEPTION:   { label: 'On Exception',     className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' },
  RETURNED:           { label: 'Returned',         className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
  PRE_EXISTING:       { label: 'Pre-existing',     className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50' },
  CLEAR:              { label: 'Clear',            className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' },
  SALE_CAR:           { label: holdBadgeConfig(['sale_car']).label,         className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800/50' },
  AUCTION_SHORT_TERM: { label: 'Auction',          className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50' },
};

const HOLD_CONFIG: Record<HoldStatus, { label: string; className: string }> = {
  ACTIVE:   { label: 'Active Hold', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' },
  RELEASED: { label: 'Released',   className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' },
  RETURNED: { label: 'Returned',   className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
  REPAIRED: { label: 'Repaired',   className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' },
  VOIDED:   { label: 'Voided',     className: 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-700/50' },
};

export function StatusBadge({ status, holdTypes, mechanicalSubType, disposition }: { status: VehicleStatus | HoldStatus; holdTypes?: HoldType[]; mechanicalSubType?: MechanicalSubType | null; disposition?: Disposition | null }) {
  const config =
    status in VEHICLE_CONFIG
      ? VEHICLE_CONFIG[status as VehicleStatus]
      : HOLD_CONFIG[status as HoldStatus];

  // ⚠️ SALE_CAR's entry above is computed ONCE at module load, so it can never see a per-car value.
  // A turnback and a buy-back therefore rendered identically to a sale for as long as the sub-type has
  // existed. Recomputed here when a disposition is supplied — still through `holdBadgeConfig`, so the
  // "SALE_CAR borrows its label, it does not get its own copy" rule above survives intact.
  //
  // `VehicleHistory` passes its sale hold's disposition too (Aaron, 2026-09-25). Until then the vehicle
  // header read "Sale Car" while the hold card underneath said "Salvage" (LUR337). That gap was scoped
  // out on 09-15 ("Hold list can still say TB/BB"), and salvage made it worth closing.
  const saleConfig =
    status === 'SALE_CAR' && disposition && disposition !== 'sale'
      ? { ...config, label: holdBadgeConfig(['sale_car'], null, disposition).label }
      : config;

  const resolved =
    holdTypes && holdTypes.length > 0 && (status === 'HELD' || status === 'ACTIVE')
      ? holdBadgeConfig(holdTypes, mechanicalSubType, disposition)
      : saleConfig ?? { label: String(status), className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${resolved.className}`}>
      {resolved.label}
    </span>
  );
}
