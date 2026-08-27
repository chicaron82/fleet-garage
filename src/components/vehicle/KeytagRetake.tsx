import { useRef, useState } from 'react';
import { compressImage } from '../../lib/image';
import { hapticLight } from '../../lib/haptics';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';

// Replace the stored key tag with a fresh photo — Aaron, 2026-08-27: *"can we just make the keytag
// editable? like if the original keytag is a bad photo it can be retaken/replaced by something new."*
//
// ⭐ IT LIVES INSIDE THE ZOOM, not on the chip row. The chip says "Key tag as read — tap to check",
// so the moment he discovers a photo is unreadable is the moment he is already looking at it
// full-screen. Putting Retake anywhere else would mean noticing on one screen and fixing on another.
// It also costs the record nothing: a row of chips he scans at a glance stays a row of chips.
//
// ⚠️ The old photo is NOT deleted. Migration 118's trigger keeps the previous URL in
// `vehicle_changes` and the file stays in the bucket — a superseded tag is evidence of what the car
// used to wear, which is exactly what the Alberta tag on that Calgary Suburban is. See
// context/keytagPhotoWrite.
export function KeytagRetake({ vehicleId, onReplaced }: {
  vehicleId: string;
  /** Fired after a successful swap so the host can close/refresh. */
  onReplaced?: () => void;
}) {
  const { retakeKeytagPhoto } = useVehicleHoldContext();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // ⚠️ Cleared immediately, so picking the SAME file twice after a failure still fires a change
    // event. Without it a retry on the identical photo silently does nothing.
    e.target.value = '';
    if (!file) return;
    setState('busy');
    const photo = await compressImage(file);
    const ok = await retakeKeytagPhoto(vehicleId, photo);
    setState(ok ? 'idle' : 'failed');
    if (ok) onReplaced?.();
  };

  return (
    <div className="flex items-center gap-2">
      {(['camera', 'gallery'] as const).map(kind => (
        <button
          key={kind}
          type="button"
          disabled={state === 'busy'}
          onClick={() => { hapticLight(); (kind === 'camera' ? cameraRef : galleryRef).current?.click(); }}
          /* 44px, gloves on — the same standard as every other control he taps at a car. */
          className="h-11 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
        >
          {state === 'busy' ? 'Replacing…' : kind === 'camera' ? '📷 Retake' : '🖼 Choose'}
        </button>
      ))}
      {state === 'failed' && (
        <span className="text-[11px] font-semibold text-red-300">Didn&apos;t save — try again.</span>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}
