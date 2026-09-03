// "Scan Key Tag" for the Holds search — snap the printed tag, read the plate, drop it into the
// search. Replaces the hit-or-miss camera barcode scan (docs/ticket-holds-keytag-replaces-barcode.md):
// the tag is always on the car, and this is the trigger point for the Geotab watchlist check.
// Thin: reuses the shipped keytag read (useKeytagRead) + the MB-prefix safety net; resolving the
// vehicle from the plate is the caller's job (onPlate → search).
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { correctManitobaPlate } from '../../../api/_lib/platePrefix';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { PhotoError } from '../shared/PhotoError';
import { ScanButton } from '../shared/ScanButton';

export function KeytagSearchScan({ onPlate, onRead, disabled = false }: {
  /** The read + MB-corrected plate — the caller feeds it into the search. */
  onPlate: (plate: string) => void;
  /** The FULL read — for a caller that wants the identity, not just the plate (the movement
   *  trip-start uses it to auto-register an unknown vehicle so its trip isn't an orphan). */
  /** The parsed read AND the image it came from — the photo is kept as the read's evidence. */
  onRead?: (read: KeytagRead, photo: string) => void;
  disabled?: boolean;
}) {
  const { readKeytag, status, error } = useKeytagRead();
  const { photoError, takeOne } = usePhotoIntake();
  const reading = status === 'reading';

  const onFile = async (file: File) => {
    const base64 = await takeOne(file);
    if (!base64) return;
    const read = await readKeytag(base64);
    const plate = correctManitobaPlate(read?.plate ?? '');
    if (plate) onPlate(plate);
    if (read) onRead?.(read, base64);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <ScanButton onFile={onFile} reading={reading} disabled={disabled} label="Scan Key Tag" />
      {status === 'error' && <span className="text-[11px] text-red-500">{error ?? 'Could not read the tag'}</span>}
      <PhotoError message={photoError} />
    </div>
  );
}
