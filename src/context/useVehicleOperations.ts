import { supabase, writeWithRefresh } from '../lib/supabase';
import { makeRevertVehicleChange } from './vehicleChangeRevert';
import { pushNotification, NOTIFY_MGMT_WIDE } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus, openSaleCarHolds } from '../lib/vehicle-status';
import { isTeslaMake } from '../lib/ev-detection';
import { normalizePlate } from '../lib/vehicleByPlate';
import { decideMint } from '../lib/mintGuard';
import { makeClearSaleHold, makeMarkReturned, makeMarkRepaired, makeCloseException, makeMarkRepairedBatch, makeMarkIssueRepaired, makeConvertToPreExisting } from './holdResolution';
import { makeVoidHold, makeDeleteHold, makeDeleteHoldPhoto, makeEditHoldDescription, makeEditHoldDamageZones, makeMarkZonesReviewed } from './holdEditing';
import { makeAddHold, makeAddRelease, makeAddPhotosToHold } from './holdWrite';
import { makeUpdateVehicleEVAssets } from './evAssetWrite';
import { makeUpdateVehicleFields } from './vehicleFieldsWrite';
import { makeUnlockVehicleField } from './fieldUnlockWrite';
import { makeRecordKeyCount } from './keyCountWrite';
import { makeSetVehicleNote } from './vehicleNoteWrite';
import { makeAttachKeytagPhotoIfMissing } from './keytagPhotoWrite';
import { makeRecordOwningArea } from './owningAreaWrite';
import { makeRecordClassCode } from './classCodeWrite';
import { makeRecordOdometer } from './odometerWrite';
import { makeReleaseUnitNumber } from './identityReconcile';
import { withSubmitLock } from '../lib/submitLock';
import type { Vehicle, Hold, BranchId, VehicleStatus, FieldSource } from '../types';

interface VehicleOperationsProps {
  allVehicles: Vehicle[];
  holds: Hold[];
  activeBranch: string;
  userId: string;
  userName: string;
  userEmployeeId: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
}

export function useVehicleOperations({
  allVehicles,
  holds,
  activeBranch,
  userId,
  userName,
  userEmployeeId,
  setAllVehicles,
  setAllHolds,
}: VehicleOperationsProps) {

  const addVehicle = async (
    vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'> & { branchId?: string; status?: VehicleStatus },
  ): Promise<string | undefined> => {
    // Double-submit guard at the convergence point, keyed on the plate — the scan
    // flows (trip-scan auto-register, overflow stack-scan) can fire a same-plate
    // register twice before React re-renders the vehicles list, and each insert
    // would mint its own UUID. A dropped re-entrant call resolves undefined (the
    // first call is doing the work) — same contract as addHold/addRelease.
    return withSubmitLock(`vehicle:${vehicle.licensePlate.trim().toUpperCase()}`, async () => {
      // MATCH-BEFORE-MINT: a car already on record must not get a SECOND row. Prefer a live match
      // over an archived one (an archived/re-plated car IS a fresh registration). See ./lib/mintGuard.
      const plateKey = normalizePlate(vehicle.licensePlate);
      const plateMatches = allVehicles.filter(v => normalizePlate(v.licensePlate) === plateKey);
      const existing = plateMatches.find(v => !v.archivedAt) ?? plateMatches[0];
      const decision = decideMint(existing, vehicle.unitNumber);
      if (decision.action === 'reuse') return decision.id; // same plate + unit already on record
      if (decision.action === 'upgrade') {
        // Plate-only stub → fill the unit + identity in place, don't double it (LFJ370 class).
        const { error: upErr } = await writeWithRefresh(() =>
          supabase.from('vehicles').update({
            unit_number:  vehicle.unitNumber,
            make:         vehicle.make,
            model:        vehicle.model,
            year:         vehicle.year,
            color:        vehicle.color,
            rental_class: vehicle.rentalClass ?? null,
            class_code:   vehicle.classCode ?? null,
            is_hybrid:    vehicle.isHybrid ?? false,
          }).eq('id', decision.id)
        );
        if (upErr) throw new Error(`Failed to upgrade vehicle stub: ${(upErr as { message?: string }).message}`);
        setAllVehicles(prev => prev.map(v => v.id === decision.id
          ? { ...v, unitNumber: vehicle.unitNumber, make: vehicle.make, model: vehicle.model, year: vehicle.year, color: vehicle.color, rentalClass: vehicle.rentalClass ?? v.rentalClass, isHybrid: vehicle.isHybrid ?? v.isHybrid }
          : v));
        return decision.id;
      }
      const id = crypto.randomUUID();
      const branchId = (vehicle.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch)) as BranchId;
      // Registration defaults to HELD (register-to-flag flow); a caller can pass a
      // status explicitly — e.g. the EV quick-add lands a transfer Tesla as CLEAR.
      const status = vehicle.status ?? 'HELD';
      // A Tesla carries exactly one key CARD — no ring, no variants — so the count is a property of
      // the make, not an observation. Applied HERE rather than in each form because eight different
      // paths mint a vehicle (quick-add, flip auto-register, proposal confirm, overflow send…) and a
      // rule spread across eight call sites is a rule the ninth one forgets. An explicit count still
      // wins; this only fills the blank.
      const keyCount = vehicle.keyCount ?? (isTeslaMake(vehicle.make) ? 1 : null);
      const { error } = await writeWithRefresh(() =>
        supabase.from('vehicles').insert({
          id,
          unit_number:       vehicle.unitNumber,
          license_plate:     vehicle.licensePlate,
          make:              vehicle.make,
          model:             vehicle.model,
          year:              vehicle.year,
          color:             vehicle.color,
          rental_class:      vehicle.rentalClass ?? null,
          class_code:        vehicle.classCode ?? null,
          key_count:         keyCount,
          keytag_photo_url:  vehicle.keytagPhotoUrl ?? null,
          branch_id:         branchId,
          status,
          is_tesla:          vehicle.isTesla ?? false,
          is_hybrid:         vehicle.isHybrid ?? false,
          has_mobile_cable:  vehicle.hasMobileCable ?? null,
          has_j1772_adapter: vehicle.hasJ1772Adapter ?? null,
        })
      );
      if (error) throw new Error(`Failed to add vehicle: ${(error as { message?: string }).message}`);
      await pushNotification(branchId, NOTIFY_MGMT_WIDE, '🚗',
        `New vehicle registered: ${vehicle.unitNumber} (${vehicle.year} ${vehicle.make} ${vehicle.model})`, 'info', { vehicleId: id });
      const newVehicle: Vehicle = { ...vehicle, id, status, branchId, keyCount };
      setAllVehicles(prev => [newVehicle, ...prev]);
      return id;
    });
  };

  // The EV-asset write (profile + stamp + unified log) lives in ./evAssetWrite
  // to keep this file under the line cap.
  const updateVehicleEVAssets = makeUpdateVehicleEVAssets({ userId, setAllVehicles });

  // Keytag-backfill write (the partial→backfill half of keytag-scan): applies FILLS
  // only, never conflicts. See ./vehicleFieldsWrite.
  const updateVehicleFields = makeUpdateVehicleFields({ setAllVehicles, allVehicles });
  // Release a manual lock on one identity field — the un-lock half of the provenance ladder.
  // See ./fieldUnlockWrite.
  const unlockVehicleField = makeUnlockVehicleField({ setAllVehicles });
  const recordKeyCount = makeRecordKeyCount({ setAllVehicles });
  const setVehicleNote = makeSetVehicleNote({ setAllVehicles });
  // Records the owning branch off a scanned tag, if-missing. See ./owningAreaWrite.
  const recordOwningArea = makeRecordOwningArea({
    setAllVehicles,
    currentOwning: id => allVehicles.find(v => v.id === id)?.owningArea,
  });

  // Records the class code off a scanned tag, if-missing. See ./classCodeWrite.
  const recordClassCode = makeRecordClassCode({
    setAllVehicles,
    currentVehicle: id => allVehicles.find(v => v.id === id),
  });

  // Keeps the odo the flip already collects. Latest-wins — see ./odometerWrite.
  const recordOdometer = makeRecordOdometer({
    setAllVehicles,
    currentOdometer: id => allVehicles.find(v => v.id === id)?.odometer,
  });
  const attachKeytagPhotoIfMissing = makeAttachKeytagPhotoIfMissing({
    setAllVehicles,
    currentKeytagUrl: id => allVehicles.find(v => v.id === id)?.keytagPhotoUrl,
  });

  // Reconcile a unit# conflict at registration: release the number from the
  // record it was on so it can land on the one being added. See ./identityReconcile.
  const releaseUnitNumber = makeReleaseUnitNumber({ setAllVehicles });

  // Hold WRITE ops (create-shaped) live in ./holdWrite; resolution ops in
  // ./holdResolution — both extracted to keep this file under the cap.
  const holdWriteDeps = { holds, allVehicles, activeBranch, userName, userEmployeeId, setAllVehicles, setAllHolds };
  const addHold         = makeAddHold(holdWriteDeps);
  const addRelease      = makeAddRelease(holdWriteDeps);
  const addPhotosToHold = makeAddPhotosToHold(holdWriteDeps);

  const markRepaired  = makeMarkRepaired({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markReturned   = makeMarkReturned({ holds, allVehicles, setAllHolds, setAllVehicles });
  const clearSaleHold  = makeClearSaleHold({ holds, allVehicles, setAllHolds, setAllVehicles });
  const convertToPreExisting = makeConvertToPreExisting({ holds, allVehicles, setAllHolds, setAllVehicles });
  const voidHold        = makeVoidHold({ holds, allVehicles, setAllHolds, setAllVehicles });
  const deleteHold      = makeDeleteHold({ holds, allVehicles, setAllHolds, setAllVehicles });
  const deleteHoldPhoto = makeDeleteHoldPhoto({ holds, allVehicles, setAllHolds, setAllVehicles });
  const editHoldDescription = makeEditHoldDescription({ holds, allVehicles, setAllHolds, setAllVehicles });
  const editHoldDamageZones = makeEditHoldDamageZones({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markZonesReviewed = makeMarkZonesReviewed({ holds, allVehicles, setAllHolds, setAllVehicles });
  const revertVehicleChange = makeRevertVehicleChange({ setAllVehicles });
  const closeException = makeCloseException({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markRepairedBatch = makeMarkRepairedBatch({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markIssueRepaired = makeMarkIssueRepaired({ holds, allVehicles, setAllHolds, setAllVehicles });

  const archiveVehicle = async (vehicleId: string) => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ archived_at: now, archived_by_id: userId }).eq('id', vehicleId)
    );
    if (error) return;
    // Void the vehicle's still-active holds — archiving removes it from the working
    // set, so a lingering ACTIVE hold would orphan: age forever, never actionable,
    // and inflate "held too long". VOIDED is the right terminal state (it neither
    // counts nor breaks a streak). Unarchiving does NOT resurrect them — re-flag if
    // the vehicle ever returns with a real issue.
    await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'VOIDED' }).eq('vehicle_id', vehicleId).eq('status', 'ACTIVE')
    );
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: now, archivedById: userId } : v
    ));
    setAllHolds(prev => prev.map(h =>
      h.vehicleId === vehicleId && h.status === 'ACTIVE' ? { ...h, status: 'VOIDED' as const } : h
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      NOTIFY_MGMT_WIDE,
      '📦',
      `Unit ${vehicle?.unitNumber ?? vehicleId} archived by ${userName}.`,
      'info',
      { vehicleId },
    );
  };

  const restoreVehicle = async (vehicleId: string) => {
    // Un-archive INTO CIRCULATION: management put a sale/auction car back, which reverses ONLY the
    // sale intent — NOT the car's real condition. So we void just the still-open sale_car holds
    // (auction's off, and they're what pinned the car at AUCTION_SHORT_TERM) and PRESERVE every other
    // hold, then RE-DERIVE the status from what survives. An accepted PRE_EXISTING scratch stays →
    // the car returns PRE_EXISTING, never a lying CLEAR (erasing a still-true condition would recreate
    // the exact old-damage-amnesia FG exists to kill). We do NOT resurrect the holds archiving voided
    // — a real ACTIVE issue on return is one deliberate re-flag.
    const vehHolds = holds.filter(h => h.vehicleId === vehicleId);
    const cancelIds = openSaleCarHolds(vehHolds).map(h => h.id);
    const survivors = vehHolds.filter(h => !cancelIds.includes(h.id));
    const newStatus = toVehicleStatus(deriveHoldStatus(survivors.map(factsFromHold)));
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ archived_at: null, archived_by_id: null, status: newStatus }).eq('id', vehicleId)
    );
    if (error) return;
    if (cancelIds.length) {
      await writeWithRefresh(() =>
        supabase.from('holds').update({ status: 'VOIDED' }).eq('vehicle_id', vehicleId).in('id', cancelIds)
      );
    }
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: undefined, archivedById: undefined, status: newStatus } : v
    ));
    setAllHolds(prev => prev.map(h =>
      cancelIds.includes(h.id) ? { ...h, status: 'VOIDED' as const } : h
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      NOTIFY_MGMT_WIDE,
      '🔄',
      `Unit ${vehicle?.unitNumber ?? vehicleId} restored to active service.`,
      'info',
      { vehicleId },
    );
  };

  const syncVehicleStatus = async (vehicleId: string) => {
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    const vehicleHolds = holds.filter(h => h.vehicleId === vehicleId && h.status !== 'REPAIRED');
    const correctStatus = toVehicleStatus(deriveHoldStatus(vehicleHolds.map(factsFromHold)));
    if (vehicle.status === correctStatus) return;
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: correctStatus }).eq('id', vehicleId)
    );
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : { ...v, status: correctStatus }));
  };

  const setCoverPhoto = async (vehicleId: string, url: string | null) => {
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ cover_photo_url: url }).eq('id', vehicleId)
    );
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : { ...v, coverPhotoUrl: url ?? undefined }));
  };

  const markVehicleEditPending = (vehicleId: string, patch: { unit: string | null; plate: string; by: string; at: string; note: string }) => {
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v,
      editSuggestedUnit: patch.unit,
      editSuggestedPlate: patch.plate,
      editSuggestedBy: patch.by,
      editSuggestedAt: patch.at,
      editSuggestionNote: patch.note,
      editStatus: 'pending',
    }));
  };

  const directEditVehicleIdentity = async (
    vehicleId: string,
    unit: string | null,
    plate: string,
    // Optional: a human correcting the make/model/year/colour/CLASS they mis-selected at
    // registration, or fixing what a wrong tag mapped to. This is a deliberate OVERWRITE and it
    // LOCKS those fields (field_sources 'manual') — the operator standing at the car outranks any
    // scan, so no future tag read overrides his edit (the CCLH-should-be-CCMH case). Omitted →
    // unit/plate-only edit, as before.
    identity?: { make: string; model: string; year: number; color: string; rentalClass: string | null; classCode?: string | null; isHybrid?: boolean },
  ) => {
    // Manual edit = the operator's confirmed truth → stamp 'manual' on every field he set, so the
    // provenance ladder (inferred < tag < manual) blocks a later scan from clobbering it. Merge into
    // the existing sources (read-modify-write; single-operator tool, no concurrent writers).
    const stamps: Record<string, FieldSource> = {};
    if (unit) stamps.unitNumber = 'manual';
    if (identity) {
      stamps.make = 'manual'; stamps.model = 'manual'; stamps.year = 'manual'; stamps.color = 'manual';
      stamps.isHybrid = 'manual';  // a human's hybrid call outranks a later tag read
      if (identity.rentalClass && identity.rentalClass.trim() !== '') stamps.rentalClass = 'manual';
      // ⚠️ A hand-corrected class code must outrank BOTH a later tag read and the migration-121
      // backfill. Without this stamp his correction would still read as 'derived' and the very next
      // scan would overwrite it — the exact loop the editable field exists to break.
      if (identity.classCode && identity.classCode.trim() !== '') stamps.classCode = 'manual';
    }
    const { data: cur } = await supabase.from('vehicles').select('field_sources').eq('id', vehicleId).maybeSingle();
    const existingSources = (cur && typeof cur.field_sources === 'object' && cur.field_sources)
      ? (cur.field_sources as Record<string, FieldSource>) : {};
    const mergedSources = { ...existingSources, ...stamps };

    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:          unit,
        license_plate:        plate,
        ...(identity ? { make: identity.make, model: identity.model, year: identity.year, color: identity.color, rental_class: identity.rentalClass, class_code: identity.classCode ?? null, is_hybrid: identity.isHybrid ?? false } : {}),
        field_sources:        mergedSources,
        edit_status:          null,
        edit_suggested_unit:  null,
        edit_suggested_plate: null,
        edit_suggested_by:    null,
        edit_suggested_at:    null,
        edit_suggestion_note: null,
        edit_reviewed_by:     null,
        edit_reviewed_at:     null,
      }).eq('id', vehicleId)
    );
    if (error) return;
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v, unitNumber: unit, licensePlate: plate, editStatus: null, fieldSources: mergedSources,
      ...(identity ? { make: identity.make, model: identity.model, year: identity.year, color: identity.color, rentalClass: identity.rentalClass } : {}),
    }));
  };

  const applyVehicleIdentity = async (vehicleId: string, unit: string | null, plate: string) => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:      unit,
        license_plate:    plate,
        edit_status:      'approved',
        edit_reviewed_by: userId,
        edit_reviewed_at: now,
      }).eq('id', vehicleId)
    );
    if (error) return;
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v, unitNumber: unit, licensePlate: plate,
      editStatus: 'approved', editReviewedBy: userId, editReviewedAt: now,
    }));
  };

  return {
    addVehicle,
    updateVehicleEVAssets,
    updateVehicleFields,
    unlockVehicleField,
    recordKeyCount,
    setVehicleNote,
    attachKeytagPhotoIfMissing,
    recordOwningArea,
    recordClassCode,
    recordOdometer,
    releaseUnitNumber,
    addHold,
    addRelease,
    addPhotosToHold,
    markRepaired,
    markRepairedBatch,
    markIssueRepaired,
    markReturned,
    clearSaleHold,
    convertToPreExisting,
    voidHold,
    deleteHold,
    deleteHoldPhoto,
    editHoldDescription,
    editHoldDamageZones,
    markZonesReviewed,
    revertVehicleChange,
    closeException,
    archiveVehicle,
    restoreVehicle,
    syncVehicleStatus,
    setCoverPhoto,
    markVehicleEditPending,
    directEditVehicleIdentity,
    applyVehicleIdentity,
  };
}
