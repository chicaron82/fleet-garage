import { useState } from 'react';
import { ShiftLogPhotoView } from './ShiftLogPhotoView';

// The board photos for ONE past day, in the washbay history (2026-08-18).
//
// Until tonight a shift-log photo was visible for exactly one shift and then gone: the hand-off
// card guards on `isToday` and the closing summary only renders inside today's form. So a photo
// taken to answer "what did the board look like" could not answer it the next morning, which is
// most of when that question gets asked.
//
// ⚠️ IT IS A DISCLOSURE, NOT A THUMBNAIL. The history is one compact line per day — thirty of them
// — and the reason these photos exist is that Aaron needs to COUNT KEYS on the board. A small
// preview would wreck the list AND be unreadable, failing twice. So the row gets a plain 📷 marker
// and the full-width image only appears when he asks for it.
export function DayShiftPhotos({ handoffUrl, closingUrl }: {
  handoffUrl?: string | null;
  closingUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const count = (handoffUrl ? 1 : 0) + (closingUrl ? 1 : 0);
  if (count === 0) return null;

  return (
    <div className="px-5 pb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
      >
        📷 {count === 1 ? '1 board photo' : `${count} board photos`} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {/* Labelled by WHICH log it came from — a board at hand-off and a board at close are
              different moments of the same day, and the whole value is knowing which you're
              looking at. */}
          <ShiftLogPhotoView url={handoffUrl} alt="The board at hand-off" caption="Hand-off" />
          <ShiftLogPhotoView url={closingUrl} alt="The board at close" caption="Close" />
        </div>
      )}
    </div>
  );
}
