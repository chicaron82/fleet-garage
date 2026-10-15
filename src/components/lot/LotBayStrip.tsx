// Erin St's count as one strip: cleans ready and dirties waiting, each with its "as of" time. Shown above the
// airport board on /lot (a driver sees what is waiting at Erin St), on the read-only /lot/view, and on FG's My Day
// card — where it also takes taps (`controls`; Aaron, 2026-10-15: *"May I suggest adding the cleans steppers here
// and tap to update the dirties? Then keep the ability to open the full detail view"*).
//
// ⚠️ Times, never initials: it is about the count, not about who is in the bay (Aaron, 2026-10-15). And never a
// bare number: his ruling is that each count is a snapshot, true as of its time. Amber past 30 min.
import { useState } from 'react';
import { BAY_DIRTIES_MAX, clockOf, isBayStale, type LotBay } from '../../lib/lotBay';
import { agoLabel, minutesAgo } from '../../lib/lotLookout';

function Stamp({ at, nowMs }: { at: string | null; nowMs: number }) {
  if (!at) return <span className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400">not counted yet</span>;
  const old = isBayStale(at, nowMs);
  return (
    <span className={`block text-[11px] ${old ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
      as of {clockOf(at)} · {agoLabel(minutesAgo(at, nowMs))}
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

/** `action` sits on the heading's right: FG's My Day card puts a link to the bay page there. */
export function LotBayStrip({ bay, nowMs, action, controls }: { bay: LotBay; nowMs: number; action?: React.ReactNode; controls?: BayControls }) {
  const [editing, setEditing] = useState(false);
  const cleansOld = isBayStale(bay.cleansAt, nowMs);
  const dirtiesOld = isBayStale(bay.dirtiesAt, nowMs);
  const dirtiesColour = dirtiesOld ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400';
  return (
    <section aria-label="Erin St" className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Erin St</h2>
        {action}
      </div>
      <div className="grid grid-cols-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-x divide-gray-200 dark:divide-gray-700">
        <div className="px-3 py-2 min-w-0">
          <b className={`block text-2xl font-extrabold tabular-nums ${cleansOld ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{bay.cleans}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">cleans ready for the airport</span>
          <Stamp at={bay.cleansAt} nowMs={nowMs} />
          {controls && (
            <div className="grid grid-cols-[1fr_1.4fr] gap-1.5 mt-1.5">
              <button type="button" onClick={() => controls.onCleans(-1)} aria-label="Minus one clean, used"
                className={`${stepBtn} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>−1</button>
              <button type="button" onClick={() => controls.onCleans(1)} aria-label="Plus one clean, parked ready"
                className={`${stepBtn} border-green-700 bg-green-700 text-white`}>+1</button>
            </div>
          )}
        </div>
        <div className="px-3 py-2 min-w-0">
          {controls && !editing ? (
            <button type="button" onClick={() => setEditing(true)} aria-label={`Dirties waiting: ${bay.dirties ?? 'not counted'}. Tap to update`}
              className="block text-left cursor-pointer">
              <b className={`block text-2xl font-extrabold tabular-nums ${dirtiesColour}`}>{bay.dirties ?? '–'} <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 underline underline-offset-2">update</span></b>
            </button>
          ) : (
            <b className={`block text-2xl font-extrabold tabular-nums ${dirtiesColour}`}>{bay.dirties ?? '–'}</b>
          )}
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">dirties waiting</span>
          <Stamp at={bay.dirtiesAt} nowMs={nowMs} />
          {controls && editing && <DirtiesEdit current={bay.dirties} onSave={controls.onDirties} onClose={() => setEditing(false)} />}
        </div>
      </div>
    </section>
  );
}
