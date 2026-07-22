import { useState } from 'react';

// The key tag this vehicle's details were READ from. Aaron's ask (2026-07-21): "if it was
// entered/read wrong can open it up to see what was on the tag and correct the details." A vision
// read can mis-see a plate or unit; without the tag there's no way to check a suspect record short
// of finding the physical car. Tap to enlarge, then use the ✏️ identity edit beside it to fix.
// Renders nothing when a vehicle has no tag on file (manual registrations, pre-scan records).
export function VehicleKeytagPhoto({ url }: { url?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
      >
        <img src={url} alt="Key tag" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700" />
        <span className="text-xs text-gray-500 dark:text-gray-400">🏷️ Key tag as read — tap to check</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/80" />
          <img src={url} alt="Key tag" className="relative max-h-[85dvh] max-w-full rounded-lg object-contain" />
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
    </>
  );
}
