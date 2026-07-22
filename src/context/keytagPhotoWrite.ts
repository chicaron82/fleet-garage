import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadPhoto } from '../lib/garage-uploads';
import type { Vehicle } from '../types';

/** Uploads the key tag a scan was read FROM and keeps it on the vehicle as evidence.
 *
 *  Why it's stored at all: a vision read can mis-see a plate or a unit#, and today the fields
 *  survive while the tag doesn't — leaving no way to check a suspect record short of finding the
 *  physical car. With the photo on the record, a bad read is auditable and correctable against
 *  its own source (the identity-edit affordance already exists). Latest tag wins: tags are
 *  reprinted when details change, so the newest read is the truth.
 *
 *  Best-effort by contract — a failed upload must never block the scan flow that triggered it,
 *  so this resolves quietly rather than throwing. Single-purpose sibling write (see keyCountWrite). */
export function makeAttachKeytagPhoto(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, photo: string): Promise<void> => {
    const url = await uploadPhoto(photo, `keytag-${vehicleId}`);
    if (!url) return;
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ keytag_photo_url: url }).eq('id', vehicleId)
    );
    if (error) return;
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, keytagPhotoUrl: url } : v)));
  };
}
