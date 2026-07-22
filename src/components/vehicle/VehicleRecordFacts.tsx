import { useState } from 'react';

// What the record knows about this car's physical handover: the key tag it was READ from, and how
// many keys are on the ring. Both live here (rather than inline in VehicleHistory, which sits at
// the line cap) so the vehicle card has somewhere to grow as more of these facts land.
//
// The tag: Aaron's ask (2026-07-21) — "if it was entered/read wrong can open it up to see what was
// on the tag and correct the details." A vision read can mis-see a plate or unit; without the tag
// there's no way to check a suspect record short of finding the physical car. Tap to enlarge, then
// use the ✏️ identity edit beside it to fix.
//
// The keys: the EXPECTED count the check-in diffs against, shown here so it can be confirmed (and
// corrected) on the record instead of only being visible at a flip.
export function VehicleRecordFacts({ keytagPhotoUrl, keyCount }: {
  keytagPhotoUrl?: string | null;
  keyCount?: number | null;
}) {
  const [open, setOpen] = useState(false);
  if (!keytagPhotoUrl && !keyCount) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {keytagPhotoUrl && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          <img src={keytagPhotoUrl} alt="Key tag" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700" />
          <span className="text-xs text-gray-500 dark:text-gray-400">🏷️ Key tag as read — tap to check</span>
        </button>
      )}

      {!!keyCount && (
        <span className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400">
          🔑 {keyCount} {keyCount === 1 ? 'key' : 'keys'} on the ring
        </span>
      )}

      {open && keytagPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/80" />
          <img src={keytagPhotoUrl} alt="Key tag" className="relative max-h-[85dvh] max-w-full rounded-lg object-contain" />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
