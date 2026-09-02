// Hold WRITE ops (create-shaped): addHold, addRelease, addPhotosToHold —
// extracted verbatim from useVehicleOperations at the 330-cap wall
// (docs/ticket-near-cap-file-extractions.md), the same factory pattern as its
// five siblings (holdResolution, holdEditing, evAssetWrite, vehicleFieldsWrite,
// identityReconcile). Resolution/editing ops live in their own siblings; this
// file is the "new hold data lands" half.
import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadPhoto, pushNotification, NOTIFY_MGMT } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus } from '../lib/vehicle-status';
import { withSubmitLock } from '../lib/submitLock';
import { commitSightingFor } from '../hooks/useVehicleSightings';
import type {
  Vehicle, Hold, Release,
  HoldType, DetailReason, MechanicalSubType, BranchId, Disposition } from '../types';

interface HoldWriteDeps {
  holds: Hold[];
  allVehicles: Vehicle[];
  activeBranch: string;
  userName: string;
  userEmployeeId: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
}

export function makeAddHold({ allVehicles, activeBranch, userName, userEmployeeId, setAllVehicles, setAllHolds }: HoldWriteDeps) {
  return async (
    vehicleId: string,
    damageDescription: string,
    notes: string,
    flaggedById: string,
    photos?: string[],
    holdTypes: HoldType[] = ['damage'],
    detailReason?: DetailReason,
    mechanicalSubType?: MechanicalSubType | null,
    linkedHoldId?: string,
    flaggedSource?: string | null, // null = hand-flagged; 'effie' when written through Effie
    // ⚠️ APPENDED, not slotted beside mechanicalSubType where it belongs semantically. Putting it
    // there shifted every later positional argument, and three callers silently started passing
    // their linkedHoldId as a disposition — caught by the compiler, which is the only reason it was
    // not shipped. An eleven-argument positional signature is the real problem here; this parameter
    // is not the place to fix it, but a future reader should know it is a known nag.
    disposition?: Disposition | null,
  ) => {
    // ⭐ Presence, same as the odometer: flagging damage means he looked at the car. Redeems a
    // typed-plate lookup's held sighting; a no-op if nothing is held. See useVehicleSightings.
    commitSightingFor(vehicleId);

    // Double-submit guard at the convergence point: every addHold caller (six and
    // counting) is protected here, not per-form. Keyed per vehicle — a re-entrant
    // flag for the same vehicle while the first is in flight is dropped. Returns the
    // created hold id + final uploaded photo URLs so callers can compose follow-ups
    // (e.g. pinning a card photo); a dropped re-entrant call resolves `undefined`.
    return withSubmitLock(`hold:${vehicleId}`, async () => {
      const holdId = crypto.randomUUID();
      const flaggedAt = new Date().toISOString();
      const branchId = (activeBranch === 'ALL' ? 'YWG' : activeBranch) as BranchId;

      const photoUrls = (await Promise.all(
        (photos ?? []).map(b => b.startsWith('data:') ? uploadPhoto(b, holdId) : Promise.resolve(b))
      )).filter((url): url is string => url !== null);

      const { error } = await writeWithRefresh(() =>
        supabase.from('holds').insert({
          id: holdId, vehicle_id: vehicleId,
          hold_type: holdTypes[0], hold_types: holdTypes,
          detail_reason: detailReason ?? null,
          mechanical_sub_type: mechanicalSubType ?? null,
          // ⚠️ Only meaningful on a sale_car hold; null everywhere else and on everything filed
          // before migration 136 — where it reads as a plain sale. Nothing branches on it.
          disposition: disposition ?? null,
          damage_description: damageDescription,
          flagged_by_id:          flaggedById,
          flagged_by_name:        userName,
          flagged_by_employee_id: userEmployeeId,
          flagged_source:         flaggedSource ?? null,
          flagged_at:             flaggedAt,
          notes, photos: photoUrls, status: 'ACTIVE',
          linked_hold_id: linkedHoldId ?? null,
          branch_id: branchId,
        })
      );
      if (error) throw new Error(`Failed to add hold: ${(error as { message?: string }).message}`);

      const unitForHold = allVehicles.find(v => v.id === vehicleId)?.unitNumber ?? vehicleId;
      await pushNotification(branchId, NOTIFY_MGMT, '🔴',
        `Hold flagged on unit ${unitForHold}: ${damageDescription}`, 'warning', { vehicleId });

      // The hold insert is the source of truth for "the hold exists", so the hold
      // is added locally unconditionally below. The vehicle status flip is a derived
      // follow-up: gate its optimistic update on the write so a failed `vehicles`
      // update (no realtime channel — won't self-heal) can't diverge from the DB.
      const { error: vehErr } = await writeWithRefresh(() =>
        supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId)
      );

      const newHold: Hold = {
        id: holdId, vehicleId, holdTypes, holdType: holdTypes[0], resolvedTypes: [], detailReason, mechanicalSubType, disposition, linkedHoldId,
        damageDescription, flaggedById,
        flaggedByName: userName, flaggedByEmployeeId: userEmployeeId,
        flaggedAt, notes, photos: photoUrls, status: 'ACTIVE', branchId,
      };
      // Idempotent local add: never show two copies of the same hold id (e.g. a
      // realtime echo arriving alongside this optimistic insert).
      setAllHolds(prev => prev.some(h => h.id === holdId) ? prev : [newHold, ...prev]);
      if (!vehErr) setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'HELD' } : v));

      return { holdId, photoUrls };
    });
  };
}

export function makeAddRelease({ holds, allVehicles, setAllVehicles, setAllHolds }: HoldWriteDeps) {
  return async (holdId: string, release: Omit<Release, 'id'>) => {
    // Keyed per hold — `hold.release` is singular downstream, so a double-submit
    // here is data corruption (two release rows on one hold), not just a UX dupe.
    await withSubmitLock(`release:${holdId}`, async () => {
      const hold = holds.find(h => h.id === holdId);
      if (!hold) throw new Error(`Hold not found: ${holdId}`);

      const releaseId = crypto.randomUUID();
      const newRelease: Release = { ...release, id: releaseId };
      // Project the post-release hold set and derive the vehicle status from the
      // shared cascade (lib/vehicle-status) so the read and write paths agree.
      const projectedHolds = holds
        .filter(h => h.vehicleId === hold.vehicleId)
        .map(h => h.id === holdId ? { ...h, status: 'RELEASED' as const, release: newRelease } : h);
      const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));

      const { error } = await writeWithRefresh(() =>
        supabase.from('releases').insert({
          id: releaseId, hold_id: holdId,
          approved_by_id: release.approvedById, approved_at: release.approvedAt,
          release_type: release.releaseType ?? 'EXCEPTION',
          release_method: release.releaseMethod ?? 'standard',
          override_authorization: release.overrideAuthorization ?? null,
          reason: release.reason,
          expected_return: release.expectedReturn ?? null,
          actual_return: release.actualReturn ?? null,
          notes: release.notes,
        })
      );
      if (error) throw new Error(`Failed to add release: ${(error as { message?: string }).message}`);

      await writeWithRefresh(() =>
        supabase.from('holds').update({ status: 'RELEASED' }).eq('id', holdId)
      );

      const unitForRelease = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
      await pushNotification(hold.branchId, ['VSA', 'Lead VSA', 'CSR', 'HIR'], '✅',
        `Unit ${unitForRelease} released — ${release.releaseType === 'EXCEPTION' ? 'on exception' : 'pre-existing'}`, 'success', { vehicleId: hold.vehicleId });

      const { error: vehErr } = await writeWithRefresh(() =>
        supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
      );

      setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, status: 'RELEASED', release: newRelease }));
      // Gate the derived vehicle-status flip on its write (vehicles has no realtime
      // self-heal). The fleet view derives status from holds regardless; this keeps
      // the stored status from diverging when the follow-up update fails.
      if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
    });
  };
}

export function makeAddPhotosToHold({ holds, setAllHolds }: HoldWriteDeps) {
  return async (holdId: string, newPhotos: string[]) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    const uploadedUrls = (await Promise.all(newPhotos.map(b => uploadPhoto(b, holdId))))
      .filter((url): url is string => url !== null);
    if (uploadedUrls.length === 0) return;
    const merged = [...(hold.photos ?? []), ...uploadedUrls];
    await writeWithRefresh(() =>
      supabase.from('holds').update({ photos: merged }).eq('id', holdId)
    );
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, photos: merged }));
  };
}
