import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import { ASSET_LABEL } from '../lib/evAssetLoans';
import type { EvAssetLoan, EvLoanAsset, Vehicle } from '../types';

// DB row (snake_case) → domain EvAssetLoan.
export function mapEvAssetLoan(r: Record<string, unknown>): EvAssetLoan {
  return {
    id:              r.id as string,
    lenderVehicleId: r.lender_vehicle_id as string,
    assetType:       r.asset_type as EvLoanAsset,
    borrowerUnit:    r.borrower_unit as string,
    status:          r.status as 'out' | 'returned',
    notes:           (r.notes as string | null) ?? null,
    createdAt:       r.created_at as string,
    createdBy:       (r.created_by as string | null) ?? null,
    returnedAt:      (r.returned_at as string | null) ?? null,
    returnedBy:      (r.returned_by as string | null) ?? null,
  };
}

/** Fetch the open (out) loans — the only ones the lender/borrower views care about. */
export async function loadOpenLoans(): Promise<EvAssetLoan[]> {
  const { data } = await supabase.from('ev_asset_loans').select('*').eq('status', 'out');
  return (data ?? []).map(r => mapEvAssetLoan(r as Record<string, unknown>));
}

/** What a return did. `incomplete` = the loan DID close, but restoring the asset on the lender (or
 *  logging it) did not land — a different thing to tell him than "nothing saved". */
export type EvLoanReturnOutcome = 'returned' | 'incomplete';

/**
 * Create + return ops for EV asset loans. Return is the two-sided close: it flips
 * the loan to `returned` AND auto-restores the lent asset to present on the lender
 * (Aaron, 2026-06-18). The restore patches **only the returned asset's** column so
 * a null/"not assessed" other asset is never clobbered to missing.
 *
 * ⚠️ A WRITE THAT FAILS MUST SAY SO (CLAUDE.md). Both ops answered a failed write with a bare
 * `return` until 2026-10-10, so a lost loan looked exactly like a saved one (line-checks 09-28 and
 * 10-10). They THROW now; every tap site runs them through `useWriteGuard`.
 * docs/October/ticket-ev-loan-writes-say-when-they-fail.md
 */
export function makeEvAssetLoanOps(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setLoans: React.Dispatch<React.SetStateAction<EvAssetLoan[]>>;
}) {
  const { setAllVehicles, setLoans } = deps;

  const createEvAssetLoan = async (
    lenderVehicleId: string, assetType: EvLoanAsset, borrowerUnit: string,
    notes: string | null, userId: string,
  ) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // Fresh id per call, so a same-frame double-tap opens two loans for the same
    // asset. Guard on lender + asset + borrower — a dropped re-entrant tap resolves
    // undefined, skipping the local append too.
    const result = await withSubmitLock(
      `evloan:${lenderVehicleId}:${assetType}:${borrowerUnit.trim().toLowerCase()}`,
      () => writeWithRefresh(() => supabase.from('ev_asset_loans').insert({
        id, lender_vehicle_id: lenderVehicleId, asset_type: assetType,
        borrower_unit: borrowerUnit.trim(), status: 'out', notes,
        created_at: now, created_by: userId,
      })),
    );
    // `!result` is the submit lock dropping a re-entrant tap: the first call is doing the work, so
    // that one is quiet on purpose. An error from the insert is a loan that does not exist.
    if (!result) return;
    if (result.error) throw new Error('ev asset loan not created');
    setLoans(prev => [{
      id, lenderVehicleId, assetType, borrowerUnit: borrowerUnit.trim(), status: 'out',
      notes, createdAt: now, createdBy: userId, returnedAt: null, returnedBy: null,
    }, ...prev]);
  };

  const returnEvAssetLoan = async (
    loan: EvAssetLoan, lender: Vehicle | undefined, userId: string,
  ): Promise<EvLoanReturnOutcome> => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() => supabase.from('ev_asset_loans')
      .update({ status: 'returned', returned_at: now, returned_by: userId })
      .eq('id', loan.id));
    if (error) throw new Error('ev asset loan not returned');

    // Auto-restore the lent asset to present on the lender, patching only its
    // column. Then log it on the unified EV timeline.
    const cablePresent   = loan.assetType === 'cable'   ? true : lender?.hasMobileCable === true;
    const adapterPresent = loan.assetType === 'adapter' ? true : lender?.hasJ1772Adapter === true;
    const patch = loan.assetType === 'cable'
      ? { has_mobile_cable: true }
      : { has_j1772_adapter: true };
    const restored = await writeWithRefresh(() => supabase.from('vehicles')
      .update({ ...patch, ev_last_updated_by: userId, ev_last_updated_at: now })
      .eq('id', loan.lenderVehicleId));
    const logged = await writeWithRefresh(() => supabase.from('ev_asset_updates').insert({
      id: crypto.randomUUID(), vehicle_id: loan.lenderVehicleId, updated_by: userId,
      source: 'vsa_washbay',
      cable_status:   cablePresent   ? 'present' : 'missing',
      adapter_status: adapterPresent ? 'present' : 'missing',
      notes: `${ASSET_LABEL[loan.assetType]} returned from unit ${loan.borrowerUnit}`,
      created_at: now,
    }));

    // The loan IS closed — that write landed — so it leaves the list either way. The asset is only
    // shown as present when the restore itself landed; otherwise the card would claim a cable the
    // database still calls missing.
    setLoans(prev => prev.filter(l => l.id !== loan.id));
    if (!restored.error) {
      setAllVehicles(prev => prev.map(v => v.id === loan.lenderVehicleId
        ? {
            ...v,
            ...(loan.assetType === 'cable' ? { hasMobileCable: true } : { hasJ1772Adapter: true }),
            evLastUpdatedBy: userId, evLastUpdatedAt: now,
          }
        : v));
    }
    return restored.error || logged.error ? 'incomplete' : 'returned';
  };

  return { createEvAssetLoan, returnEvAssetLoan };
}
