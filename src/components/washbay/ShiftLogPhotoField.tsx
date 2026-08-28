import { useRef, useState } from 'react';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { PhotoError } from '../shared/PhotoError';

interface Props {
  /** Compressed base64 of the chosen photo, or null. Owned by the parent form so it travels with
   *  the rest of the log's state through submit. */
  value: string | null;
  onChange: (base64: string | null) => void;
  /** An already-saved photo on a log being edited — shown when nothing new has been picked. */
  existingUrl?: string | null;
}

/**
 * The optional context photo on a shift log — in practice, the key board.
 *
 * Aaron, 2026-08-17: *"adding a photo for additional context in the logs. totally optional. shift
 * hand-off. backlog was selected. photo of the board."*
 *
 * ⭐ IT SITS WITH LOT STATUS, NOT IN NOTES, and that placement is the feature. `lotStatus` is a
 * judgment — one of three words. This is the evidence for the word he just picked: every key on a
 * hook is a car still sitting there, so the photo measures the same fact his adjective describes.
 * Filed under "Notes" it would read as trivia; filed under the picker it reads as proof.
 *
 * Capture only — no crop, no markup, no multi-photo. This is a five-second action at the end of a
 * shift where the alternative is not doing it at all, and every extra tap is a shift where the
 * board goes unphotographed.
 */
export function ShiftLogPhotoField({ value, onChange, existingUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { photoError, takeOne } = usePhotoIntake();

  const preview = value ?? existingUrl ?? null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    // ⚠️ THE CATCH HERE USED TO BE EMPTY — "a failed compress must not strand the form" was right,
    // and silence was the wrong way to honour it: the photo vanished and the field looked untouched,
    // so he would believe it saved. Not stranding him means TELLING him, then letting him retry.
    const photo = await takeOne(file);
    if (photo) onChange(photo);
    setBusy(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-2">
      <PhotoError message={photoError} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          📷 Photo <span className="opacity-70">— optional context, e.g. the key board</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition cursor-pointer"
          >
            {busy ? '…' : preview ? 'Replace' : 'Add photo'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Remove photo"
              className="px-2 py-1 rounded-md text-xs font-semibold text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        // `capture` opens the camera directly on a phone — he's standing at the board, not
        // browsing a gallery.
        capture="environment"
        className="hidden"
        onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }}
      />

      {preview && (
        <img
          src={preview}
          alt="Shift log context photo"
          className="w-full max-h-48 object-cover rounded-md border border-gray-200 dark:border-gray-700"
        />
      )}
    </div>
  );
}
