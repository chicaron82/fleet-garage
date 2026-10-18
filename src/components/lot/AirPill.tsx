// The airport in FG's top bar, beside Erin's 7/3: two squares, room for cleans on the left and returns on the right,
// each in its notch's colour. Tap them for the times. (Migration 157; docs/ticket-lot-lookout-swatches-too-many-targets.md.)
//
// ⭐ Aaron, 2026-10-18, over the mock: *"i like the addition to the header, but its not accounting for the the other
// items already residing there. is there enough room to fit everything? should it just be colours? perhaps a tap for
// time?"*. Measured at his 412px as the VSA mock: ~35px spare, so colours only (~34px). With his trip timer up the
// title gives way and the logo stays. The squares never fade (*"scrap the stale time"*): age lives in the tapped card.
//
// Hidden until the airport row exists, so a missing table never puts an error in the top bar.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NOTCH_HEX, RETURNS_TEXT, ROOM_TEXT } from '../../lib/lotAirport';
import { hapticLight } from '../../lib/haptics';
import { useLotAirport } from '../../hooks/useLotAirport';
import { useTapOutsideClose } from '../../hooks/useTapOutsideClose';
import { AirportReadout } from './AirportReadout';

function Square({ hex }: { hex: string | null }) {
  return <span aria-hidden="true" className={`w-[11px] h-[11px] rounded-[3px] ${hex ? '' : 'border border-gray-400 dark:border-gray-500'}`} style={hex ? { background: hex } : undefined} />;
}

/** `where` names this pill's realtime channel: the top bar and the scan sheet each mount one. */
export function AirPill({ where }: { where: 'topbar' | 'scan' }) {
  const airport = useLotAirport(`lot-airport-pill-${where}`);
  const [open, setOpen] = useState(false);
  const outside = useTapOutsideClose(() => setOpen(false));
  if (!airport.loaded || airport.error) return null;
  const r = airport.readings;
  const label = `Airport: ${r.cleans == null ? 'room not read' : ROOM_TEXT[r.cleans]}, ${r.returns == null ? 'returns not read' : RETURNS_TEXT[r.returns]}${r.aisle ? ', cars in the aisle' : ''}. Tap for times`;
  return (
    <>
      <button type="button" onClick={() => { hapticLight(); setOpen(o => !o); }} aria-label={label} aria-expanded={open}
        className={`flex items-center gap-[3px] h-[26px] px-[7px] rounded-full border bg-gray-50 dark:bg-gray-800 cursor-pointer active:scale-95 transition ${
          r.aisle ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-700'}`}>
        <Square hex={r.cleans == null ? null : NOTCH_HEX[r.cleans]} />
        <Square hex={r.returns == null ? null : NOTCH_HEX[r.returns]} />
      </button>
      {/* Portalled to <body>, like Erin's sheet: opened from inside the scan sheet it must sit over that sheet. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60]" {...outside}>
          <div className="absolute right-3 top-14 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl px-4 py-3.5 space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Airport</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none cursor-pointer">✕</button>
            </div>
            <AirportReadout r={r} nowMs={airport.nowMs} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
