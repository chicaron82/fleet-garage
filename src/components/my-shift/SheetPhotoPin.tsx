// The sheet's photo, pinned above the rows while he types (2026-11-09: *"that sounds bougie AF!!"*). It never leaves
// the phone: an object URL for this page only, dropped when it closes. Tap the photo to zoom; drag to pan (a finger
// pans natively; a mouse through useDragPan below).
// Pinned just under FG's top bar (sticky top-14, under its z-40) while the rows scroll beneath it. `data-sticky-cover`
// tells VehicleLookup it is there, so the plate field never scrolls itself in under it (2026-11-11).
import { useEffect, useRef, useState, type PointerEvent } from 'react';

export function SheetPhotoPin() {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [small, setSmall] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pan = useDragPan();
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setUrl(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
    setZoom(false);
    setSmall(false);
  };

  return (
    <div className={url ? 'sticky top-14 z-30 bg-white dark:bg-gray-900 pb-2' : undefined} data-sticky-cover={url ? '' : undefined}>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Sheet photo"
        onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!url ? (
        <button type="button" onClick={() => input.current?.click()}
          className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
          📷 Pin the sheet's photo
        </button>
      ) : (
        <div className="space-y-1.5">
          <div {...pan.handlers}
            className={`overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-black select-none ${pan.dragging ? 'cursor-grabbing' : 'cursor-grab'} ${small ? 'max-h-24' : 'max-h-[42vh]'}`}
            data-testid="sheet-photo">
            <img src={url} alt="The gas sheet" draggable={false} onClick={() => { if (!pan.wasDrag()) setZoom(z => !z); }}
              className={`block max-w-none ${zoom ? 'w-[250%]' : 'w-full'}`} />
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

/**
 * Press and drag the photo with a mouse to move it, like a map. Aaron, 2026-11-11: *"can i move it around using the
 * mouse instead of relying on the scrollbars"*. A finger already pans the box natively, so only a mouse is handled.
 * ⚠️ A drag that MOVED is not a click: without `wasDrag` every pan would end by toggling the zoom.
 */
function useDragPan() {
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const end = () => { start.current = null; setDragging(false); };
  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      moved.current = false;
      el.setPointerCapture?.(e.pointerId);
      setDragging(true);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      e.currentTarget.scrollLeft = s.left - dx;
      e.currentTarget.scrollTop = s.top - dy;
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
  // Read once by the click that ends the drag, then cleared, so a later tap is a tap again.
  const wasDrag = () => { const m = moved.current; moved.current = false; return m; };
  return { handlers, dragging, wasDrag };
}
