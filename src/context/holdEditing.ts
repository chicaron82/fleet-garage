import type { Dispatch, SetStateAction } from 'react';
import { orderZones } from '../lib/damageZones';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { deleteDamagePhotos } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus } from '../lib/vehicle-status';
import type { Hold, Vehicle } from '../types';

// Destructive hold-history EDITS — correcting mistakes (a duplicate hold, a wrongly-attached
// photo), distinct from ./holdResolution (which moves a REAL hold through its lifecycle).
// Same shared-state shape + status-reconcile cascade. releases/repairs cascade on a hold delete
// (FK ON DELETE CASCADE). Storage cleanup is best-effort — the DB is the source of truth, an
// orphaned file is recoverable, a blocked correction isn't. See docs/ticket-holds-history-edit.md.
interface EditDeps {
  holds: Hold[];
  allVehicles: Vehicle[];
  setAllHolds: Dispatch<SetStateAction<Hold[]>>;
  setAllVehicles: Dispatch<SetStateAction<Vehicle[]>>;
}

/** Re-derive a vehicle's status from a projected hold set + persist it (shared cascade). */
async function reconcileVehicleStatus(
  vehicleId: string,
  projectedHolds: Hold[],
  setAllVehicles: EditDeps['setAllVehicles'],
): Promise<void> {
  const status = toVehicleStatus(
    deriveHoldStatus(projectedHolds.filter(h => h.vehicleId === vehicleId).map(factsFromHold)),
  );
  const { error } = await writeWithRefresh(() =>
    supabase.from('vehicles').update({ status }).eq('id', vehicleId));
  if (!error) setAllVehicles(prev => prev.map(v => (v.id !== vehicleId ? v : { ...v, status })));
}

/** If a URL is a vehicle's cover photo, clear the cover (a deleted file would render broken). */
async function clearCoverIfMatch(
  vehicleId: string,
  removedUrls: string[],
  allVehicles: Vehicle[],
  setAllVehicles: EditDeps['setAllVehicles'],
): Promise<void> {
  const veh = allVehicles.find(v => v.id === vehicleId);
  if (!veh?.coverPhotoUrl || !removedUrls.includes(veh.coverPhotoUrl)) return;
  await writeWithRefresh(() =>
    supabase.from('vehicles').update({ cover_photo_url: null }).eq('id', vehicleId));
  setAllVehicles(prev => prev.map(v => (v.id !== vehicleId ? v : { ...v, coverPhotoUrl: undefined })));
}

/** VOID a hold (soft) — keep the record, mark it VOIDED, reconcile the vehicle status. For
 *  cancelling a hold that really happened but no longer applies. */
export function makeVoidHold({ holds, setAllHolds, setAllVehicles }: EditDeps) {
  return async (holdId: string): Promise<void> => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'VOIDED' }).eq('id', holdId));
    if (error) throw new Error(`Failed to void hold: ${(error as { message?: string }).message}`);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, status: 'VOIDED' as const })));
    await reconcileVehicleStatus(
      hold.vehicleId,
      holds.map(h => (h.id === holdId ? { ...h, status: 'VOIDED' as const } : h)),
      setAllVehicles,
    );
  };
}

/** DELETE a hold (hard) — the row (releases/repairs cascade), its photos from storage, and
 *  reconcile the vehicle status + cover photo. For a mistake / duplicate. */
export function makeDeleteHold({ holds, allVehicles, setAllHolds, setAllVehicles }: EditDeps) {
  return async (holdId: string): Promise<void> => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').delete().eq('id', holdId));
    if (error) throw new Error(`Failed to delete hold: ${(error as { message?: string }).message}`);
    void deleteDamagePhotos(hold.photos ?? []); // best-effort storage cleanup
    setAllHolds(prev => prev.filter(h => h.id !== holdId));
    await clearCoverIfMatch(hold.vehicleId, hold.photos ?? [], allVehicles, setAllVehicles);
    await reconcileVehicleStatus(hold.vehicleId, holds.filter(h => h.id !== holdId), setAllVehicles);
  };
}

/** EDIT a hold's description text — correcting a wording mistake (e.g. an Effie misread of the
 *  damage side/position: "driver-side" that was really passenger). Pure text: the description
 *  never drives vehicle status, so no reconcile cascade. Trimmed + non-empty (a blank
 *  description would erase the record's meaning — delete/void the hold instead). */
export function makeEditHoldDescription({ holds, setAllHolds }: EditDeps) {
  return async (holdId: string, description: string): Promise<void> => {
    const text = description.trim();
    if (!text) throw new Error('Description cannot be empty.');
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ damage_description: text }).eq('id', holdId));
    if (error) throw new Error(`Failed to edit description: ${(error as { message?: string }).message}`);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, damageDescription: text })));
  };
}

/** SET a hold's damage zones — which body panels the damage sits on.
 *
 *  ⭐ Deliberately not a photo flow. Aaron's cut of 2026-08-22: the photos are already on the
 *  record, so tagging a zone is annotation, not capture — which is the only reason the 441 holds
 *  already on the books can ever be tagged at all. Tie it to a live camera and the feature reaches
 *  forward only, and the old circulating damage FG exists for stays unqueryable forever.
 *
 *  Like the description, zones are pure metadata: they never drive vehicle status, so there is no
 *  reconcile cascade. An EMPTY array is legal and meaningful — it is how a mistagged hold is
 *  cleared, so this must not borrow the description's non-empty guard. */
export function makeEditHoldDamageZones({ setAllHolds }: EditDeps) {
  return async (holdId: string, zones: string[]): Promise<void> => {
    const next = orderZones(zones);   // stable on write, whatever order he tapped
    // ⚠️ EXISTENCE IS CHECKED AGAINST THE DATABASE, not the local array. This used to do
    // `holds.find(...)` first — a lookup in a closure captured at RENDER time. That is fine for a
    // hold the screen is already showing, and wrong for one created moments ago: `addHold`'s
    // `setAllHolds` is asynchronous, so writing zones on the line after it created the hold looked
    // up an array that predates it and threw "Hold not found" for a hold that plainly exists.
    // Found while wiring zone collection into the new-hold form (2026-08-24) — the local lookup was
    // standing in for "does this hold exist?", and the proxy went false while the property stayed
    // true. `.select('id')` asks the only authority that can actually answer.
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ damage_zones: next }).eq('id', holdId).select('id'));
    if (error) throw new Error(`Failed to save damage zones: ${(error as { message?: string }).message}`);
    if (!(data as unknown[] | null)?.length) throw new Error(`Hold not found: ${holdId}`);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, damageZones: next })));
  };
}

/** MARK a hold as reviewed-with-no-panel — the backfill queue stops asking about it.
 *
 *  ⭐ Queue state, never vehicle state (migrations/125). The hold keeps its status, its notes and
 *  its photos, and still appears everywhere it did before; the ONLY thing this answers is the
 *  backfill's "which panel?". For the faults with no place on Vehicle Inspection #9000501's body
 *  diagram — a camera lens proud of its housing, a bed liner eaten by a spill.
 *
 *  Passing `false` clears it and puts the hold back in the queue, because a tap made in error must
 *  be as cheap to undo as it was to make. Like zones and descriptions: pure metadata, no vehicle
 *  status cascade. */
export function makeMarkZonesReviewed({ setAllHolds }: EditDeps) {
  return async (holdId: string, reviewed = true): Promise<void> => {
    const at = reviewed ? new Date().toISOString() : null;
    // Same DB-grounded existence check as editHoldDamageZones, and for the same reason: the form
    // marks "no panel applies" on a hold it created a moment earlier, which the render-time array
    // has not seen yet.
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ zones_reviewed_at: at }).eq('id', holdId).select('id'));
    if (error) throw new Error(`Failed to save: ${(error as { message?: string }).message}`);
    if (!(data as unknown[] | null)?.length) throw new Error(`Hold not found: ${holdId}`);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, zonesReviewedAt: at })));
  };
}

/** Remove ONE photo from a hold — the array, the storage file, and the cover if it was pinned. */
export function makeDeleteHoldPhoto({ holds, allVehicles, setAllHolds, setAllVehicles }: EditDeps) {
  return async (holdId: string, photoUrl: string): Promise<void> => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const nextPhotos = (hold.photos ?? []).filter(u => u !== photoUrl);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ photos: nextPhotos }).eq('id', holdId));
    if (error) throw new Error(`Failed to remove photo: ${(error as { message?: string }).message}`);
    void deleteDamagePhotos([photoUrl]);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, photos: nextPhotos })));
    await clearCoverIfMatch(hold.vehicleId, [photoUrl], allVehicles, setAllVehicles);
  };
}
