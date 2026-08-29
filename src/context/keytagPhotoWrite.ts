import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadPhoto } from '../lib/garage-uploads';
import type { Vehicle } from '../types';

/** Uploads the key tag a scan was read FROM and keeps it on the vehicle as evidence — but ONLY if
 *  the vehicle doesn't already have one (attach-if-missing).
 *
 *  Why it's stored at all: a vision read can mis-see a plate or a unit#, and today the fields
 *  survive while the tag doesn't — leaving no way to check a suspect record short of finding the
 *  physical car. With the photo on the record, a bad read is auditable and correctable against its
 *  own source (the identity-edit affordance already exists).
 *
 *  Why IF-MISSING (reversed from the old "latest tag wins", 2026-08-05 — ticket-universal-keytag-
 *  capture): the same car gets scanned repeatedly across ~7-10 surfaces, and an unconditional write
 *  let a later, possibly-worse scan CLOBBER a good tag photo. First good tag wins; re-capturing a
 *  tag is a deliberate identity-edit action, not an automatic side effect of any scan. One universal
 *  behaviour lives here so no calling surface has to remember the guard.
 *
 *  Best-effort by contract — a failed upload must never block the scan flow that triggered it, so
 *  this resolves quietly rather than throwing. Single-purpose sibling write (see keyCountWrite). */
export function makeAttachKeytagPhotoIfMissing(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  /** Latest known keytag-photo URL for a vehicle (render-time is fine). Lets us skip the upload
   *  entirely in the common already-has-one case; the DB `.is(null)` guard below is the race-safe
   *  backstop that guarantees no clobber even if this read lags. */
  currentKeytagUrl: (vehicleId: string) => string | null | undefined;
}) {
  const { setAllVehicles, currentKeytagUrl } = deps;

  return async (vehicleId: string, photo: string): Promise<void> => {
    if (currentKeytagUrl(vehicleId)) return; // already has a tag — never clobber a good one
    const url = await uploadPhoto(photo, `keytag-${vehicleId}`);
    if (!url) return;
    // Race-safe if-missing: `.is(null)` fills only an empty slot, so two near-simultaneous scans
    // can't clobber each other; `.select` tells us whether we actually wrote.
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ keytag_photo_url: url }).eq('id', vehicleId).is('keytag_photo_url', null).select('id')
    );
    if (error || !data?.length) return; // 0 rows = another write filled it first → don't diverge local state
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, keytagPhotoUrl: url } : v)));
  };
}

/** RETAKES the key tag photo — the deliberate replace the if-missing rule above always deferred to.
 *
 *  Aaron, 2026-08-27: *"can we just make the keytag editable? like if the original keytag is a bad
 *  photo it can be retaken/replaced by something new."*
 *
 *  ⭐ ATTACH-IF-MISSING GETS ONE THING WRONG, and this is it. That rule exists to stop a WORSE photo
 *  clobbering a GOOD one — but it cannot tell worse from better, so it assumes the FIRST one was
 *  best. It is right about automatic writes and wrong about a person. Aaron tapping "retake" is the
 *  only thing in the system that has actually looked at both. The comment above already said as
 *  much — *"re-capturing a tag is a deliberate identity-edit action"* — and then there was nowhere
 *  to do it.
 *
 *  Covers every case in one control: a blurry original, a tag faded past reading (he sent me one he
 *  could not read with his own eyes), a re-print, and a re-plate — where the car wears a genuinely
 *  new tag and the stored one is now a picture of the past.
 *
 *  ⚠️ THE OLD PHOTO IS NOT DELETED, and needs no new storage to survive. Migration 118's trigger
 *  already logs every `keytag_photo_url` change, so the previous URL is in `vehicle_changes` with
 *  its date, and the file itself stays in the bucket. A superseded tag is evidence of what the car
 *  used to wear — for the Suburban that came from Calgary, its Alberta tag is the ONLY record of its
 *  old plate. Same reasoning as a cleared note keeping its history: a correction that erases what it
 *  corrected is a second, tidier lie.
 *
 *  ⚠️ SWAPS THE PICTURE, NEVER RE-READS IT. Aaron's call, and the right one: re-reading would spend a
 *  model call and let a worse photo overwrite good fields. A retake is about the EVIDENCE; the scan
 *  path already owns the reading and all its provenance rules.
 *
 *  Returns false when nothing was written, so no caller can report a success that did not happen. */
export function makeRetakeKeytagPhoto(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, photo: string): Promise<boolean> => {
    const url = await uploadPhoto(photo, `keytag-${vehicleId}`);
    if (!url) return false;
    // ⚠️ No `.is(null)` guard here, and that is the entire difference from the write above. This one
    // is MEANT to overwrite — the guard is the operator, not the query.
    // ⭐⭐ THE RETAKE ALSO CLEARS THE AUDIT STAMP, and until 2026-08-29 it did not — while migration
    // 130's own comment claimed it did: "a retake later clears it back to NULL, putting the car back
    // in line for its audit." The code never did that. A car flagged `unreadable` would have kept the
    // flag through a fresh photo, stayed on the retake watchlist forever, and never re-entered the
    // audit queue — the retake would have fixed the evidence and changed nothing about the record.
    //
    // ⚠️ Clears the STAMP, not the fields. Whatever he confirmed on the old photo stays `manual` and
    // stays locked; only "has a person read THIS photo" is reset, which a new photo makes true by
    // definition. Same reasoning as reopenKeytagAudit.
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        keytag_photo_url: url,
        keytag_audited_at: null,
        keytag_audited_by: null,
        keytag_audit_result: null,
      }).eq('id', vehicleId).select('id')
    );
    if (error || !data?.length) return false;
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? {
      ...v, keytagPhotoUrl: url,
      keytagAuditedAt: null, keytagAuditedBy: null, keytagAuditResult: null,
    } : v)));
    return true;
  };
}
