// The sheet's photo, pinned above the rows while he types (2026-11-09: *"that sounds bougie AF!!"*). It never leaves
// the phone: an object URL for this page only, dropped when it closes. Tap the photo to zoom; drag to pan.
// Pinned just under FG's top bar (sticky top-14, under its z-40) while the rows scroll beneath it.
import { useEffect, useRef, useState } from 'react';

export function SheetPhotoPin() {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [small, setSmall] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
    setZoom(false);
    setSmall(false);
  };

  return (
    <div className={url ? 'sticky top-14 z-30 bg-white dark:bg-gray-900 pb-2' : undefined}>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Sheet photo"
        onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!url ? (
        <button type="button" onClick={() => input.current?.click()}
          className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
          📷 Pin the sheet's photo
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className={`overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-black ${small ? 'max-h-24' : 'max-h-[42vh]'}`}
            data-testid="sheet-photo">
            <img src={url} alt="The gas sheet" onClick={() => setZoom(z => !z)}
              className={`block max-w-none cursor-zoom-in ${zoom ? 'w-[250%]' : 'w-full'}`} />
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <button type="button" onClick={() => setZoom(z => !z)} className="px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer">
              {zoom ? 'Fit' : 'Zoom'}
            </button>
            <button type="button" onClick={() => setSmall(s => !s)} className="px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer">
              {small ? 'Bigger' : 'Smaller'}
            </button>
            <button type="button" onClick={() => input.current?.click()} className="px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer">
              Other photo
            </button>
            <button type="button" onClick={() => setUrl(null)} className="ml-auto px-2.5 py-1 rounded-md text-gray-500 dark:text-gray-400 cursor-pointer">
              Unpin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
