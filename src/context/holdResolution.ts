import { supabase, writeWithRefresh } from '../lib/supabase';
import { pushNotification } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus, findLinkedOpenException } from '../lib/vehicle-status';
import { withSubmitLock } from '../lib/submitLock';
import type { Hold, HoldType, Vehicle, Repair } from '../types';

// Hold-resolution ops that move a hold out of ACTIVE and reconcile the vehicle
// status. Extracted from useVehicleOperations to keep it under the 330-line cap;
// each factory closes over the same shared state the hook owns.
interface ResolutionDeps {
  holds: Hold[];
  allVehicles: Vehicle[];
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}

// Mark an exception-released vehicle as physically returned. Hardcodes the
// vehicle to RETURNED and fires the "re-evaluation required" alarm to managers —
// the return of a real held vehicle, not an error correction.
export function makeMarkReturned({ holds, allVehicles, setAllHolds, setAllVehicles }: ResolutionDeps) {
  return async (holdId: string) => {
    const returnedAt = new Date().toISOString();
    const hold = holds.find(h => h.id === holdId);
    // Throw like addRelease/markRepaired so confirmReturn's caller can tell a
    // vanished hold from a successful return, instead of a silent no-op.
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    // Primary write — throw on failure so the caller (useReEval.confirmReturn)
    // can surface it rather than flipping local state on a write that didn't land.
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId)
    );
    if (error) throw new Error(`Failed to mark returned: ${(error as { message?: string }).message}`);
    if (hold.release) await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: returnedAt }).eq('id', hold.release!.id)
    );
    const { error: vehErr } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: 'RETURNED' }).eq('id', hold.vehicleId)
    );
    const unitForReturn = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['Branch Manager', 'Operations Manager'], '🔁',
      `Exception vehicle ${unitForReturn} has returned. Re-evaluation required.`, 'urgent', { vehicleId: hold.vehicleId });
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : {
      ...h, status: 'RETURNED',
      release: h.release ? { ...h.release, actualReturn: returnedAt } : undefined,
    }));
    if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: 'RETURNED' }));
  };
}

// Clear a sale/auction flag logged in error (plates pulled off rentable backlog
// that was never actually a sale car). Voids the sale_car hold — RETURNED drops
// it out of both the active and the open-exception branches of the status
// cascade, so the vehicle derives back to clear/rentable — closes any short-term
// auction release, and pings management for awareness (not the re-evaluation
// alarm markReturned fires).
export function makeClearSaleHold({ holds, allVehicles, setAllHolds, setAllVehicles }: ResolutionDeps) {
  return async (holdId: string, clearedByName: string) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const clearedAt = new Date().toISOString();
    // Primary write — throw on failure like the sibling ops so the caller can
    // surface it instead of flipping local state on a write that didn't land.
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'VOIDED' }).eq('id', holdId)
    );
    if (error) throw new Error(`Failed to clear sale flag: ${(error as { message?: string }).message}`);
    if (hold.release) await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: clearedAt }).eq('id', hold.release!.id)
    );
    // Derive the corrected vehicle status from the remaining holds (shared cascade)
    // — lands on clear unless a separate genuine hold still grounds the vehicle.
    const projectedHolds = holds
      .filter(h => h.vehicleId === hold.vehicleId)
      .map(h => h.id === holdId
        ? { ...h, status: 'VOIDED' as const, release: h.release ? { ...h.release, actualReturn: clearedAt } : undefined }
        : h);
    const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));
    const { error: vehErr } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
    );
    const unit = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['Branch Manager', 'Operations Manager'], 'ℹ️',
      `Sale/auction flag cleared on unit ${unit} (logged in error) by ${clearedByName}.`, 'info', { vehicleId: hold.vehicleId });
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : {
      ...h, status: 'VOIDED',
      release: h.release ? { ...h.release, actualReturn: clearedAt } : undefined,
    }));
    if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
  };
}

// Record a hold's issue as physically repaired and reconcile the vehicle status.
// When the repaired hold is a re-hold linking back to a prior exception release
// (`linkedHoldId`), that linked exception only existed to cover for this same
// issue — so repairing it auto-closes the linked exception in the same op: the
// release's `actual_return` is stamped (as of the repair) and the linked hold is
// resolved like a normal return, so the vehicle derives off-exception in one pass
// instead of staying stuck behind a stale sibling. Only an explicitly linked open
// EXCEPTION is closed — never a fuzzy text match (see `findLinkedOpenException`).
// The shared finalize: record the repair, flip the hold to REPAIRED (stamping the
// resolved issue set), auto-close any linked open exception, and re-derive the
// vehicle from the shared cascade. Used by the whole-hold `markRepaired` (all
// issues at once) and the per-issue `markIssueRepaired` final flip — one path, so
// the linked-close + derivation can't drift between them.
async function finalizeRepairedHold(
  { holds, setAllHolds, setAllVehicles }: ResolutionDeps,
  hold: Hold,
  repair: Omit<Repair, 'id'>,
  resolvedTypes: HoldType[],
) {
  const repairId = crypto.randomUUID();
  const newRepair: Repair = { ...repair, id: repairId };
  // Primary write — throw on failure like addHold/addRelease so callers can
  // surface it, instead of silently flipping the hold + local state to REPAIRED
  // while the repairs table got nothing.
  const { error } = await writeWithRefresh(() =>
    supabase.from('repairs').insert({
      id: repairId, hold_id: hold.id,
      repaired_by_id: repair.repairedById, repaired_at: repair.repairedAt, notes: repair.notes,
      outcome: repair.outcome,
    })
  );
  if (error) throw new Error(`Failed to record repair: ${(error as { message?: string }).message}`);
  await writeWithRefresh(() =>
    supabase.from('holds').update({ status: 'REPAIRED', resolved_types: resolvedTypes }).eq('id', hold.id)
  );

  // If this repair resolves a linked prior exception, close it too: stamp the
  // release's actual_return (as of the repair) and resolve the linked hold like
  // a normal return, so its open-exception fact clears in the projection below.
  const linked = findLinkedOpenException(hold, holds);
  if (linked) {
    await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: repair.repairedAt }).eq('id', linked.release!.id)
    );
    await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'RETURNED' }).eq('id', linked.id)
    );
  }

  // Project the post-repair hold set (repaired hold + any closed linked
  // exception) and derive the vehicle status from the shared cascade.
  const projectedHolds = holds
    .filter(h => h.vehicleId === hold.vehicleId)
    .map(h => {
      if (h.id === hold.id) return { ...h, status: 'REPAIRED' as const };
      if (linked && h.id === linked.id) return {
        ...h, status: 'RETURNED' as const,
        release: h.release ? { ...h.release, actualReturn: repair.repairedAt } : undefined,
      };
      return h;
    });
  const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));
  const { error: vehErr } = await writeWithRefresh(() =>
    supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
  );
  if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
  setAllHolds(prev => prev.map(h => {
    if (h.id === hold.id) return { ...h, status: 'REPAIRED', resolvedTypes, repair: newRepair };
    if (linked && h.id === linked.id) return {
      ...h, status: 'RETURNED',
      release: h.release ? { ...h.release, actualReturn: repair.repairedAt } : undefined,
    };
    return h;
  }));
}

export function makeMarkRepaired(deps: ResolutionDeps) {
  return async (holdId: string, repair: Omit<Repair, 'id'>) => {
    const hold = deps.holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    // Whole-hold repair: every issue resolved at once.
    await finalizeRepairedHold(deps, hold, repair, hold.holdTypes);
  };
}

// Resolve ONE issue within a (possibly multi-type) hold. Appends the type to
// resolved_types; the hold stays ACTIVE — and the vehicle stays held via the
// unchanged cascade — until resolved_types covers every hold_type, at which point
// the whole hold is finalized to REPAIRED exactly like a single-issue repair
// (repairs row, linked-exception auto-close, vehicle re-derive). `repair` carries
// the notes/outcome and is required only for the final flip; intermediate
// resolutions just check the box. Re-resolving an already-cleared issue is a no-op.
export function makeMarkIssueRepaired(deps: ResolutionDeps) {
  const { holds, setAllHolds } = deps;
  return async (holdId: string, type: HoldType, repair?: Omit<Repair, 'id'>) =>
    withSubmitLock(`repair:${holdId}`, async () => {
      const hold = holds.find(h => h.id === holdId);
      if (!hold) throw new Error(`Hold not found: ${holdId}`);
      const next = hold.resolvedTypes.includes(type)
        ? hold.resolvedTypes
        : [...hold.resolvedTypes, type];
      const isFinal = hold.holdTypes.every(t => next.includes(t));

      if (isFinal) {
        if (!repair) throw new Error('Repair details are required to resolve the final issue');
        await finalizeRepairedHold(deps, hold, repair, next);
        return;
      }
      // Intermediate: record the cleared issue only. Hold stays ACTIVE, so the
      // vehicle stays held by construction — no repairs row, no re-derive.
      const { error } = await writeWithRefresh(() =>
        supabase.from('holds').update({ resolved_types: next }).eq('id', holdId)
      );
      if (error) throw new Error(`Failed to resolve issue: ${(error as { message?: string }).message}`);
      setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, resolvedTypes: next }));
    });
}

// Manually close a hold's OPEN exception without a physical return — for a stale
// or orphaned exception (the issue was resolved another way, or the hold was a
// duplicate) that's keeping a vehicle stuck On-Exception. Stamps the release's
// actual_return, resolves the hold like a normal return, and re-derives the
// vehicle from the shared cascade (→ clear unless another genuine hold grounds
// it). Pings management for awareness — but NOT the re-evaluation alarm, since
// nothing physically returned. A management-level liability call (gated upstream
// by canRelease — the inverse of putting a car on exception in the first place).
export function makeCloseException({ holds, allVehicles, setAllHolds, setAllVehicles }: ResolutionDeps) {
  return async (holdId: string, resolvedByName: string) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const resolvedAt = new Date().toISOString();
    // Primary write — throw on failure like the sibling ops so the caller can
    // surface it instead of flipping local state on a write that didn't land.
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId)
    );
    if (error) throw new Error(`Failed to close exception: ${(error as { message?: string }).message}`);
    if (hold.release) await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: resolvedAt }).eq('id', hold.release!.id)
    );
    // Re-derive from the projected hold set — lands clear unless a separate genuine
    // hold still grounds the vehicle.
    const projectedHolds = holds
      .filter(h => h.vehicleId === hold.vehicleId)
      .map(h => h.id === holdId
        ? { ...h, status: 'RETURNED' as const, release: h.release ? { ...h.release, actualReturn: resolvedAt } : undefined }
        : h);
    const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));
    const { error: vehErr } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
    );
    const unit = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['Branch Manager', 'Operations Manager'], 'ℹ️',
      `Exception on unit ${unit} resolved (closed without return) by ${resolvedByName}.`, 'info', { vehicleId: hold.vehicleId });
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : {
      ...h, status: 'RETURNED',
      release: h.release ? { ...h.release, actualReturn: resolvedAt } : undefined,
    }));
    if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
  };
}

// Mark SEVERAL holds on one vehicle as repaired in a single pass — the batch
// behind the "resolve multiple" picker (e.g. a re-flag + its stale original,
// both genuinely fixed). Looping the single markRepaired would be WRONG: each
// call derives the vehicle status from its own closed-over `holds` snapshot, so
// the last write would reflect only its own hold's change and clobber the rest.
// Instead, this writes every repair, then projects ALL targets as REPAIRED and
// derives the vehicle status ONCE from that full projection. Same shared notes /
// outcome for the batch. (No linked auto-close here — the picker resolves exactly
// what's checked; the single-hold path keeps the `findLinkedOpenException` close.)
export function makeMarkRepairedBatch({ holds, setAllHolds, setAllVehicles }: ResolutionDeps) {
  return async (holdIds: string[], repair: Omit<Repair, 'id'>) => {
    const targets = holds.filter(h => holdIds.includes(h.id));
    if (targets.length === 0) throw new Error('No holds to repair');
    const vehicleId = targets[0].vehicleId;
    // All targets must share one vehicle: the projection below filters holds by
    // vehicleId and derives ONE vehicle status, so a cross-vehicle batch would
    // write every repair but re-derive only the first vehicle — the others would
    // keep a stale status. Today's only caller (the per-vehicle repair picker)
    // can't produce this; fail fast before any write in case a second caller can.
    if (targets.some(t => t.vehicleId !== vehicleId)) {
      throw new Error('Batch repair must target holds on a single vehicle');
    }
    const repairsById = new Map<string, Repair>();
    for (const t of targets) {
      const repairId = crypto.randomUUID();
      repairsById.set(t.id, { ...repair, id: repairId, holdId: t.id });
      // Primary write per hold — throw on failure like single markRepaired.
      const { error } = await writeWithRefresh(() =>
        supabase.from('repairs').insert({
          id: repairId, hold_id: t.id,
          repaired_by_id: repair.repairedById, repaired_at: repair.repairedAt, notes: repair.notes,
          outcome: repair.outcome,
        })
      );
      if (error) throw new Error(`Failed to record repair: ${(error as { message?: string }).message}`);
      await writeWithRefresh(() =>
        supabase.from('holds').update({ status: 'REPAIRED', resolved_types: t.holdTypes }).eq('id', t.id)
      );
    }
    // Project EVERY target as REPAIRED at once, then derive the vehicle once.
    const projectedHolds = holds
      .filter(h => h.vehicleId === vehicleId)
      .map(h => holdIds.includes(h.id) ? { ...h, status: 'REPAIRED' as const } : h);
    const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));
    const { error: vehErr } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', vehicleId)
    );
    if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : { ...v, status: newVehicleStatus }));
    setAllHolds(prev => prev.map(h => {
      const r = repairsById.get(h.id);
      return r ? { ...h, status: 'REPAIRED' as const, resolvedTypes: h.holdTypes, repair: r } : h;
    }));
  };
}
