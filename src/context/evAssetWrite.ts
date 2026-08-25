import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle, EvSource } from '../types';

// The single EV-asset write path. Updates the vehicle's canonical accessory
// status, stamps who/when, and appends a source-tagged row to the unified
// ev_asset_updates timeline — so every touchpoint (check-in, driver, washbay,
// management) lands on one timeline and "when did the cable/adapter go missing"
// is a single query. Extracted from useVehicleOperations to keep it under the
// 330-line cap; closes over the same shared state the hook owns.
export function makeUpdateVehicleEVAssets(deps: {
  userId: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { userId, setAllVehicles } = deps;

  return async (
    vehicleId: string,
    hasMobileCable: boolean,
    hasJ1772Adapter: boolean,
    source: EvSource,
    notes?: string,
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        has_mobile_cable:   hasMobileCable,
        has_j1772_adapter:  hasJ1772Adapter,
        ev_last_updated_by: userId,
        ev_last_updated_at: now,
      }).eq('id', vehicleId)
    );
    // Gate the optimistic update on success. `vehicles` has no realtime channel
    // (only `holds` does), so a silently-failed write here would not self-heal —
    // local state would diverge from the DB until a full reload.
    //
    // ⭐ Returns whether the canonical status actually landed. It used to return void and swallow
    // the failure, which meant a CALLER could not tell a saved assessment from a lost one — and
    // RegisterVehicleForm's `try/catch` around this call was dead code, because nothing here ever
    // throws. Its "⚠️ the EV asset check didn't save" warning could not fire, so a failed write
    // reported as a clean registration (Reflection 62, 2026-08-24 — the same defect R61 found the
    // night before: a success message claiming a write that never happened).
    if (error) return false;
    // Append to the unified EV timeline. Best-effort: a failed log row shouldn't
    // undo the profile update that already landed.
    await writeWithRefresh(() => supabase.from('ev_asset_updates').insert({
      id:             crypto.randomUUID(),
      vehicle_id:     vehicleId,
      updated_by:     userId,
      source,
      cable_status:   hasMobileCable  ? 'present' : 'missing',
      adapter_status: hasJ1772Adapter ? 'present' : 'missing',
      notes:          notes ?? null,
      created_at:     now,
    }));
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId
        ? { ...v, hasMobileCable, hasJ1772Adapter, evLastUpdatedBy: userId, evLastUpdatedAt: now }
        : v
    ));
    return true;
  };
}
