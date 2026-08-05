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
