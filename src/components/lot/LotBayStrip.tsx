// Erin St's count as one strip: cleans ready and dirties waiting, each with its "as of" time. Shown above the
// airport board on /lot (a driver sees what is waiting at Erin St), on the read-only /lot/view, and on FG's My Day
// card — where it also takes taps (`controls`; Aaron, 2026-10-15: *"May I suggest adding the cleans steppers here
// and tap to update the dirties? Then keep the ability to open the full detail view"*).
//
// ⚠️ Times, never initials: it is about the count, not about who is in the bay (Aaron, 2026-10-15). And never a
// bare number: his ruling is that each count is a snapshot, true as of its time. Amber past 30 min.
import { useState } from 'react';
import { BAY_DIRTIES_MAX, isBayStale, whenOf, type LotBay } from '../../lib/lotBay';
import { agoLabel, minutesAgo } from '../../lib/lotLookout';

// ⭐ IDLE (2026-11-25, docs/ticket-lot-view-stale-count-louder.md): once the count isn't being kept (2 h, countKept.ts)
// and a viewer chose Show it anyway, the time is the loudest thing in the cell: bigger, and a slow pulse. Aaron: someone
// read yesterday 15:02's 4/5 early in the morning *"and thought we would have 9 vehicles ready to send soon"*. Only when
// idle, never at the 30-min amber, which fires on any slow half hour and would teach everyone to ignore it.
// `motion-safe`: a device set to reduce motion gets it big and amber, still.
const IDLE_STAMP = 'block mt-0.5 text-sm lg:text-xl font-extrabold text-amber-700 dark:text-amber-400 motion-safe:animate-pulse';

function Stamp({ at, nowMs, idle = false }: { at: string | null; nowMs: number; idle?: boolean }) {
  if (!at) return <span className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400">not counted yet</span>;
  const old = isBayStale(at, nowMs);
  return (
    <span data-stamp={idle ? 'idle' : undefined} className={idle ? IDLE_STAMP : `block text-[11px] ${old ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
      as of {whenOf(at, nowMs)} · {agoLabel(minutesAgo(at, nowMs))}
    </span>
  );
}

export interface BayControls {
  onCleans: (delta: 1 | -1) => void;
  /** Resolves true when the count saved. */
  onDirties: (count: number) => Promise<boolean>;
}

const stepBtn = 'min-h-11 rounded-xl border-2 text-base font-extrabold cursor-pointer touch-manipulation';

function DirtiesEdit({ current, onSave, onClose }: { current: number | null; onSave: (n: number) => Promise<boolean>; onClose: () => void }) {
  const [typed, setTyped] = useState(current == null ? '' : String(current));
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = typed.trim();
    if (!/^\d+$/.test(t) || Number(t) > BAY_DIRTIES_MAX) { setErr(`0 to ${BAY_DIRTIES_MAX}`); return; }
    if (await onSave(Number(t))) onClose();
  };
  return (
    <form onSubmit={e => void submit(e)} className="mt-1 space-y-1">
      <div className="flex gap-1.5">
      <input id="card-dirties" autoFocus inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label="New dirty count"
        value={typed} onChange={e => { setTyped(e.target.value); setErr(''); }} onFocus={e => e.currentTarget.select()}
        className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-center font-mono text-lg font-bold" />
      <button type="submit" className="rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi px-3 text-sm font-semibold text-black cursor-pointer">Save</button>
      <button type="button" onClick={onClose} aria-label="Cancel" className="rounded-lg px-1.5 text-gray-500 dark:text-gray-400 cursor-pointer">✕</button>
      </div>
      {err && <p role="alert" className="text-[11px] font-semibold text-red-700 dark:text-red-400">Type a number, {err}</p>}
    </form>
  );
}

/** `action` sits on the heading's right: FG's My Day card puts a link to the bay page there.
 *  `big`: the read-only page's desktop glance (docs/ticket-lot-view-desktop-layout.md). From `lg` up the counts grow to
 *  read from across a desk; on a phone it changes nothing. */
/** `idle`: the read-only page's count is past being kept and shown anyway; the stamps go loud (see IDLE_STAMP). */
export function LotBayStrip({ bay, nowMs, action, controls, big = false, idle = false }: { bay: LotBay; nowMs: number; action?: React.ReactNode; controls?: BayControls; big?: boolean; idle?: boolean }) {
  const [editing, setEditing] = useState(false);
  const cleansOld = isBayStale(bay.cleansAt, nowMs);
  const dirtiesOld = isBayStale(bay.dirtiesAt, nowMs);
  const dirtiesColour = dirtiesOld ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400';
  const num = big ? 'text-2xl lg:text-8xl lg:leading-none lg:mb-3' : 'text-2xl';
  const cell = big ? 'px-3 py-2 lg:px-6 lg:py-7 min-w-0' : 'px-3 py-2 min-w-0';
  const what = big ? 'block text-[11px] lg:text-base lg:font-semibold text-gray-500 dark:text-gray-400' : 'block text-[11px] text-gray-500 dark:text-gray-400';
  // The read-only column's sizer hooks (lotFit.css): only the big strip shrinks.
  const fitNum = big ? { 'data-fit-big': '' } : {}, fitCell = big ? { 'data-fit-cell': '' } : {}, fitWhat = big ? { 'data-fit-what': '' } : {};
  return (
    <section aria-label="Erin St" className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Erin St</h2>
        {action}
      </div>
      <div className="grid grid-cols-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-x divide-gray-200 dark:divide-gray-700">
        <div {...fitCell} className={cell}>
          <b {...fitNum} className={`block ${num} font-extrabold tabular-nums ${cleansOld ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{bay.cleans}</b>
          <span {...fitWhat} className={what}>cleans ready for the airport</span>
          <Stamp at={bay.cleansAt} nowMs={nowMs} idle={idle} />
          {controls && (
            <div className="grid grid-cols-[1fr_1.4fr] gap-1.5 mt-1.5">
              <button type="button" onClick={() => controls.onCleans(-1)} aria-label="Minus one clean, used"
                className={`${stepBtn} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>−1</button>
              <button type="button" onClick={() => controls.onCleans(1)} aria-label="Plus one clean, parked ready"
                className={`${stepBtn} border-green-700 bg-green-700 text-white`}>+1</button>
            </div>
          )}
        </div>
        <div {...fitCell} className={cell}>
          {controls && !editing ? (
            <button type="button" onClick={() => setEditing(true)} aria-label={`Dirties waiting: ${bay.dirties ?? 'not counted'}. Tap to update`}
              className="block text-left cursor-pointer">
              <b className={`block text-2xl font-extrabold tabular-nums ${dirtiesColour}`}>{bay.dirties ?? '–'} <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 underline underline-offset-2">update</span></b>
            </button>
          ) : (
            <b {...fitNum} className={`block ${num} font-extrabold tabular-nums ${dirtiesColour}`}>{bay.dirties ?? '–'}</b>
          )}
          <span {...fitWhat} className={what}>dirties waiting</span>
          <Stamp at={bay.dirtiesAt} nowMs={nowMs} idle={idle} />
          {controls && editing && <DirtiesEdit current={bay.dirties} onSave={controls.onDirties} onClose={() => setEditing(false)} />}
        </div>
      </div>
    </section>
  );
}
